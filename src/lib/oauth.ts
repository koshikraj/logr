import { createHash, randomBytes, timingSafeEqual } from "crypto";
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { prisma } from "@/lib/db";

/**
 * Minimal in-house OAuth 2.1 authorization server for the MCP endpoint
 * (issue #58 phase 2). Deliberately small surface:
 *
 *   - authorization-code grant with PKCE (S256) only — no secrets, no other
 *     grants; clients are public and register dynamically (RFC 7591)
 *   - consent rides on the existing Auth.js (Google/X) session; a grant is
 *     bound at consent time to the signed-in user's own profile
 *   - codes and tokens are opaque `logr_*` strings, stored sha256-hashed
 *   - refresh rotates both tokens; the old refresh token dies with the swap
 *
 * The resource-server half (bearer verification on /mcp) lives here too so
 * both sides share one hashing/lookup convention.
 */

export const OAUTH_SCOPES = ["events:write", "profile:write"] as const;

const CODE_TTL_MS = 10 * 60_000; // authorization codes: 10 minutes
const ACCESS_TTL_MS = 60 * 60_000; // access tokens: 1 hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000; // refresh tokens: 30 days

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newSecret = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

// ---------- dynamic client registration (RFC 7591) ----------

/** Loopback redirects are fine over http; anything else must be https. */
export function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export async function registerClient(metadata: {
  redirect_uris?: unknown;
  client_name?: unknown;
}): Promise<Record<string, unknown>> {
  const uris = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (!uris.length || !uris.every(isValidRedirectUri)) {
    throw new OAuthError(
      OAuthErrorCode.InvalidRedirectUri,
      "redirect_uris must be a non-empty array of https or loopback-http URLs"
    );
  }
  const name = String(metadata.client_name ?? "").trim().slice(0, 120) || "Unnamed MCP client";
  const client = await prisma.oAuthClient.create({
    data: { name, redirectUris: JSON.stringify(uris.slice(0, 10)) },
  });
  return {
    client_id: client.id,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: name,
    redirect_uris: uris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

// ---------- authorize (validation + code issuance) ----------

export type AuthorizeRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  scopes: string[];
  state: string | null;
  codeChallenge: string;
  resource: string | null;
};

/** Validate an authorization request. Returns the request when sound, a
 *  `redirect` error (safe to send back to the client's redirect_uri), or a
 *  `fatal` error (unknown client / bad redirect_uri — must render, never
 *  redirect, per OAuth 2.1). */
export async function validateAuthorizeRequest(params: {
  [k: string]: string | undefined;
}): Promise<
  | { ok: true; request: AuthorizeRequest }
  | { ok: false; kind: "fatal"; error: string }
  | { ok: false; kind: "redirect"; redirectUri: string; error: string; state: string | null }
> {
  const clientId = params.client_id ?? "";
  const client = clientId
    ? await prisma.oAuthClient.findUnique({ where: { id: clientId } })
    : null;
  if (!client) return { ok: false, kind: "fatal", error: "Unknown client_id." };

  let registered: string[] = [];
  try {
    registered = JSON.parse(client.redirectUris) as string[];
  } catch {
    /* treated as none registered */
  }
  const redirectUri = params.redirect_uri ?? "";
  if (!registered.includes(redirectUri)) {
    return { ok: false, kind: "fatal", error: "redirect_uri is not registered for this client." };
  }

  const state = params.state ?? null;
  const fail = (error: string) =>
    ({ ok: false, kind: "redirect", redirectUri, error, state }) as const;

  if (params.response_type !== "code") return fail("unsupported_response_type");
  if (!params.code_challenge) return fail("invalid_request");
  if ((params.code_challenge_method ?? "S256") !== "S256") return fail("invalid_request");
  if (params.resource !== undefined && !/\/mcp\/?$/.test(params.resource)) {
    return fail("invalid_target");
  }

  // Empty scope = everything we offer; otherwise must be a known subset.
  const requested = (params.scope ?? "").split(" ").filter(Boolean);
  const scopes = requested.length ? requested : [...OAUTH_SCOPES];
  if (!scopes.every((s) => (OAUTH_SCOPES as readonly string[]).includes(s))) {
    return fail("invalid_scope");
  }

  return {
    ok: true,
    request: {
      clientId: client.id,
      clientName: client.name,
      redirectUri,
      scopes,
      state,
      codeChallenge: params.code_challenge,
      resource: params.resource ?? null,
    },
  };
}

/** Mint the authorization code after the signed-in owner consents. */
export async function issueAuthorizationCode(
  request: AuthorizeRequest,
  grantee: { userId: string; profileId: string }
): Promise<string> {
  const code = newSecret("logr_ac");
  await prisma.oAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: request.clientId,
      userId: grantee.userId,
      profileId: grantee.profileId,
      redirectUri: request.redirectUri,
      scope: request.scopes.join(" "),
      codeChallenge: request.codeChallenge,
      resource: request.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

// ---------- token endpoint ----------

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

function pkceMatches(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function mintTokens(grant: {
  clientId: string;
  userId: string;
  profileId: string;
  scope: string;
}): Promise<TokenResponse> {
  const accessToken = newSecret("logr_at");
  const refreshToken = newSecret("logr_rt");
  await prisma.oAuthToken.create({
    data: {
      clientId: grant.clientId,
      userId: grant.userId,
      profileId: grant.profileId,
      scope: grant.scope,
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: grant.scope,
  };
}

export async function exchangeAuthorizationCode(params: {
  code?: string;
  client_id?: string;
  redirect_uri?: string;
  code_verifier?: string;
}): Promise<TokenResponse> {
  const { code, client_id, redirect_uri, code_verifier } = params;
  if (!code || !client_id || !redirect_uri || !code_verifier) {
    throw new OAuthError(OAuthErrorCode.InvalidRequest, "Missing required token parameters");
  }
  const row = await prisma.oAuthCode.findUnique({ where: { codeHash: sha256(code) } });
  const invalid = new OAuthError(OAuthErrorCode.InvalidGrant, "Invalid authorization code");
  if (!row || row.consumedAt || row.expiresAt < new Date()) throw invalid;
  if (row.clientId !== client_id || row.redirectUri !== redirect_uri) throw invalid;
  if (!pkceMatches(code_verifier, row.codeChallenge)) throw invalid;

  // single use — consume before minting so a replay can never race a token
  await prisma.oAuthCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return mintTokens(row);
}

/** Rotate on refresh: new access + refresh, old refresh token dies. The
 *  refresh horizon is not extended, bounding a grant's total silent life. */
export async function refreshAccessToken(params: {
  refresh_token?: string;
  client_id?: string;
}): Promise<TokenResponse> {
  const { refresh_token, client_id } = params;
  if (!refresh_token || !client_id) {
    throw new OAuthError(OAuthErrorCode.InvalidRequest, "Missing required token parameters");
  }
  const row = await prisma.oAuthToken.findUnique({
    where: { refreshTokenHash: sha256(refresh_token) },
  });
  const invalid = new OAuthError(OAuthErrorCode.InvalidGrant, "Invalid refresh token");
  if (!row || row.revokedAt || row.refreshExpiresAt < new Date()) throw invalid;
  if (row.clientId !== client_id) throw invalid;

  const accessToken = newSecret("logr_at");
  const refreshToken = newSecret("logr_rt");
  await prisma.oAuthToken.update({
    where: { id: row.id },
    data: {
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshToken),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    },
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: row.scope,
  };
}

// ---------- resource-server side (bearer verification on /mcp) ----------

export const tokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const invalid = new OAuthError(OAuthErrorCode.InvalidToken, "Invalid or expired access token");
    if (!token.startsWith("logr_at_")) throw invalid;
    const row = await prisma.oAuthToken.findUnique({
      where: { accessTokenHash: sha256(token) },
    });
    if (!row || row.revokedAt || row.accessExpiresAt < new Date()) throw invalid;
    // usage timestamp is best-effort telemetry for the owner's agents panel
    prisma.oAuthToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return {
      token,
      clientId: row.clientId,
      scopes: row.scope.split(" ").filter(Boolean),
      expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000),
      extra: { userId: row.userId, profileId: row.profileId },
    };
  },
};

// ---------- discovery metadata ----------

/** RFC 8414 Authorization Server Metadata. Issuer follows the serving origin
 *  so local/preview testing discovers working endpoints. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...OAUTH_SCOPES],
  };
}

/** RFC 9728 Protected Resource Metadata for the /mcp resource server. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    resource_name: "logr MCP server",
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [...OAUTH_SCOPES],
  };
}

// ---------- owner's "connected agents" panel ----------

export type GrantView = {
  id: string;
  clientName: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

export async function listGrantsForProfile(profileId: string): Promise<GrantView[]> {
  const rows = await prisma.oAuthToken.findMany({
    where: { profileId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    clientName: r.client.name,
    scope: r.scope,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    expiresAt: r.refreshExpiresAt.toISOString(),
  }));
}

export async function revokeGrantForProfile(profileId: string, tokenId: string): Promise<void> {
  // scoped update: a grant can only be revoked by the profile it belongs to
  await prisma.oAuthToken.updateMany({
    where: { id: tokenId, profileId },
    data: { revokedAt: new Date() },
  });
}
