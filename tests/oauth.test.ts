import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash, randomBytes } from "crypto";

vi.mock("@/lib/db", () => ({
  prisma: {
    oAuthClient: { create: vi.fn(), findUnique: vi.fn() },
    oAuthCode: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    oAuthToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  registerClient,
  validateAuthorizeRequest,
  issueAuthorizationCode,
  exchangeAuthorizationCode,
  refreshAccessToken,
  tokenVerifier,
  authorizationServerMetadata,
  protectedResourceMetadata,
} from "@/lib/oauth";

const clientCreate = prisma.oAuthClient.create as ReturnType<typeof vi.fn>;
const clientFind = prisma.oAuthClient.findUnique as ReturnType<typeof vi.fn>;
const codeCreate = prisma.oAuthCode.create as ReturnType<typeof vi.fn>;
const codeFind = prisma.oAuthCode.findUnique as ReturnType<typeof vi.fn>;
const codeUpdate = prisma.oAuthCode.update as ReturnType<typeof vi.fn>;
const tokenCreate = prisma.oAuthToken.create as ReturnType<typeof vi.fn>;
const tokenFind = prisma.oAuthToken.findUnique as ReturnType<typeof vi.fn>;
const tokenUpdate = prisma.oAuthToken.update as ReturnType<typeof vi.fn>;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const CLIENT_ROW = {
  id: "client1",
  name: "Test Agent",
  redirectUris: JSON.stringify(["https://agent.example/callback"]),
  createdAt: new Date(),
};

function authorizeParams(overrides: Record<string, string | undefined> = {}) {
  return {
    client_id: "client1",
    redirect_uri: "https://agent.example/callback",
    response_type: "code",
    code_challenge: "x".repeat(43),
    code_challenge_method: "S256",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clientFind.mockResolvedValue(CLIENT_ROW);
});

describe("dynamic client registration", () => {
  it("registers a public PKCE client", async () => {
    clientCreate.mockResolvedValue(CLIENT_ROW);
    const res = await registerClient({
      client_name: "Test Agent",
      redirect_uris: ["https://agent.example/callback", "http://localhost:8080/cb"],
    });
    expect(res.client_id).toBe("client1");
    expect(res.token_endpoint_auth_method).toBe("none");
  });

  it("rejects non-https, non-loopback redirect URIs", async () => {
    await expect(
      registerClient({ redirect_uris: ["http://evil.example/cb"] })
    ).rejects.toThrow(/redirect_uris/);
    await expect(registerClient({ redirect_uris: [] })).rejects.toThrow(/redirect_uris/);
    expect(clientCreate).not.toHaveBeenCalled();
  });
});

describe("authorize request validation", () => {
  it("accepts a sound request and defaults scope to everything offered", async () => {
    const result = await validateAuthorizeRequest(authorizeParams());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.scopes.sort()).toEqual(["events:write", "profile:write"]);
      expect(result.request.clientName).toBe("Test Agent");
    }
  });

  it("fails fatally (no redirect) on unknown client or unregistered redirect_uri", async () => {
    clientFind.mockResolvedValue(null);
    const unknown = await validateAuthorizeRequest(authorizeParams());
    expect(unknown).toMatchObject({ ok: false, kind: "fatal" });

    clientFind.mockResolvedValue(CLIENT_ROW);
    const badRedirect = await validateAuthorizeRequest(
      authorizeParams({ redirect_uri: "https://evil.example/cb" })
    );
    expect(badRedirect).toMatchObject({ ok: false, kind: "fatal" });
  });

  it("returns redirect-class errors for bad scope / missing PKCE", async () => {
    const badScope = await validateAuthorizeRequest(authorizeParams({ scope: "admin:all" }));
    expect(badScope).toMatchObject({ ok: false, kind: "redirect", error: "invalid_scope" });

    const noPkce = await validateAuthorizeRequest(
      authorizeParams({ code_challenge: undefined })
    );
    expect(noPkce).toMatchObject({ ok: false, kind: "redirect", error: "invalid_request" });
  });
});

describe("code exchange (PKCE)", () => {
  async function issuedCode() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    let stored: Record<string, unknown> = {};
    codeCreate.mockImplementation(({ data }) => {
      stored = { id: "code1", consumedAt: null, ...data };
      return Promise.resolve(stored);
    });
    const code = await issueAuthorizationCode(
      {
        clientId: "client1",
        clientName: "Test Agent",
        redirectUri: "https://agent.example/callback",
        scopes: ["events:write"],
        state: "s1",
        codeChallenge: challenge,
        resource: null,
      },
      { userId: "u1", profileId: "p1" }
    );
    return { code, verifier, stored };
  }

  it("mints tokens for a valid code + verifier and consumes the code", async () => {
    const { code, verifier, stored } = await issuedCode();
    expect(stored.codeHash).toBe(sha256(code));
    codeFind.mockResolvedValue(stored);
    codeUpdate.mockResolvedValue({});
    tokenCreate.mockResolvedValue({});

    const tokens = await exchangeAuthorizationCode({
      code,
      client_id: "client1",
      redirect_uri: "https://agent.example/callback",
      code_verifier: verifier,
    });
    expect(tokens.access_token).toMatch(/^logr_at_/);
    expect(tokens.refresh_token).toMatch(/^logr_rt_/);
    expect(tokens.scope).toBe("events:write");
    expect(codeUpdate).toHaveBeenCalled(); // consumed
    const row = tokenCreate.mock.calls[0][0].data;
    expect(row.accessTokenHash).toBe(sha256(tokens.access_token));
    expect(row.profileId).toBe("p1");
  });

  it("rejects a wrong verifier, a consumed code, and an expired code", async () => {
    const { code, stored } = await issuedCode();
    codeFind.mockResolvedValue(stored);
    await expect(
      exchangeAuthorizationCode({
        code,
        client_id: "client1",
        redirect_uri: "https://agent.example/callback",
        code_verifier: "wrong-verifier-wrong-verifier-wrong-verifier",
      })
    ).rejects.toThrow(/Invalid authorization code/);

    codeFind.mockResolvedValue({ ...stored, consumedAt: new Date() });
    await expect(
      exchangeAuthorizationCode({
        code,
        client_id: "client1",
        redirect_uri: "https://agent.example/callback",
        code_verifier: "x",
      })
    ).rejects.toThrow(/Invalid authorization code/);

    codeFind.mockResolvedValue({ ...stored, expiresAt: new Date(Date.now() - 1000) });
    await expect(
      exchangeAuthorizationCode({
        code,
        client_id: "client1",
        redirect_uri: "https://agent.example/callback",
        code_verifier: "x",
      })
    ).rejects.toThrow(/Invalid authorization code/);
    expect(tokenCreate).not.toHaveBeenCalled();
  });
});

describe("refresh rotation", () => {
  const tokenRow = {
    id: "t1",
    clientId: "client1",
    userId: "u1",
    profileId: "p1",
    scope: "events:write",
    refreshTokenHash: sha256("logr_rt_old"),
    accessExpiresAt: new Date(Date.now() - 1000),
    refreshExpiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
  };

  it("rotates both tokens on refresh", async () => {
    tokenFind.mockResolvedValue(tokenRow);
    tokenUpdate.mockResolvedValue({});
    const tokens = await refreshAccessToken({
      refresh_token: "logr_rt_old",
      client_id: "client1",
    });
    const patch = tokenUpdate.mock.calls[0][0].data;
    expect(patch.accessTokenHash).toBe(sha256(tokens.access_token));
    expect(patch.refreshTokenHash).toBe(sha256(tokens.refresh_token));
    expect(tokens.refresh_token).not.toBe("logr_rt_old");
  });

  it("rejects revoked or expired refresh tokens", async () => {
    tokenFind.mockResolvedValue({ ...tokenRow, revokedAt: new Date() });
    await expect(
      refreshAccessToken({ refresh_token: "logr_rt_old", client_id: "client1" })
    ).rejects.toThrow(/Invalid refresh token/);

    tokenFind.mockResolvedValue({ ...tokenRow, refreshExpiresAt: new Date(Date.now() - 1) });
    await expect(
      refreshAccessToken({ refresh_token: "logr_rt_old", client_id: "client1" })
    ).rejects.toThrow(/Invalid refresh token/);
  });
});

describe("bearer verification", () => {
  it("maps a live token row to AuthInfo", async () => {
    tokenFind.mockResolvedValue({
      id: "t1",
      clientId: "client1",
      userId: "u1",
      profileId: "p1",
      scope: "events:write profile:write",
      accessExpiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    tokenUpdate.mockResolvedValue({});
    const info = await tokenVerifier.verifyAccessToken("logr_at_live");
    expect(info.clientId).toBe("client1");
    expect(info.scopes).toEqual(["events:write", "profile:write"]);
    expect(info.extra).toMatchObject({ userId: "u1", profileId: "p1" });
  });

  it("rejects unknown, revoked, and expired tokens", async () => {
    tokenFind.mockResolvedValue(null);
    await expect(tokenVerifier.verifyAccessToken("logr_at_nope")).rejects.toThrow();
    await expect(tokenVerifier.verifyAccessToken("not-our-format")).rejects.toThrow();

    tokenFind.mockResolvedValue({
      id: "t1",
      revokedAt: new Date(),
      accessExpiresAt: new Date(Date.now() + 60_000),
      scope: "",
      clientId: "c",
      userId: "u",
      profileId: "p",
    });
    await expect(tokenVerifier.verifyAccessToken("logr_at_revoked")).rejects.toThrow();
  });
});

describe("discovery metadata", () => {
  it("derives endpoints from the serving origin", () => {
    const as = authorizationServerMetadata("https://logr.it");
    expect(as.issuer).toBe("https://logr.it");
    expect(as.token_endpoint).toBe("https://logr.it/api/oauth/token");
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);

    const pr = protectedResourceMetadata("https://logr.it");
    expect(pr.resource).toBe("https://logr.it/mcp");
    expect(pr.authorization_servers).toEqual(["https://logr.it"]);
  });
});
