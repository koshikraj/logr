import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Minimal X (Twitter) OAuth 2.0 client for the CONNECT flow — deliberately
// outside Auth.js: Auth.js cannot link a second provider to the current
// session's User (completing OAuth mid-session signs you into the *other*
// account), and X often returns no email for the adapter to match on. So we
// run the dance ourselves and write the Account row explicitly
// (see /api/x/connect + /api/x/callback). Login afterwards is stock Auth.js.
//
// X mandates PKCE (S256) and, for confidential clients, HTTP basic auth on
// the token exchange. Tokens are used once for /2/users/me and discarded.

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";
export const X_SCOPES = "users.read tweet.read"; // both required just to read own profile

export const X_COOKIE = "x_oauth"; // short-lived state+verifier during the dance

export function isXConnectEnabled(): boolean {
  return Boolean(process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET);
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function newOAuthState(): { state: string; verifier: string; challenge: string } {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { state, verifier, challenge };
}

export function authorizeUrl(origin: string, state: string, challenge: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.AUTH_TWITTER_ID!,
    redirect_uri: `${origin}/api/x/callback`,
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${p}`;
}

/** Exchange the code, fetch the authenticated user, discard the tokens. */
export async function exchangeAndFetchUser(
  origin: string,
  code: string,
  verifier: string
): Promise<{ id: string; username: string; name: string }> {
  const basic = Buffer.from(`${process.env.AUTH_TWITTER_ID}:${process.env.AUTH_TWITTER_SECRET}`).toString("base64");
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/x/callback`,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("no access token in response");

  const meRes = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!meRes.ok) throw new Error(`users/me failed (${meRes.status})`);
  const { data } = (await meRes.json()) as { data?: { id: string; username: string; name: string } };
  if (!data?.id || !data.username) throw new Error("malformed users/me response");
  return data;
}
