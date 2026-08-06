import { NextRequest } from "next/server";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/oauth";
import { rateLimited, visitorHash } from "@/lib/ratelimit";

// OAuth 2.1 token endpoint: authorization_code (+ PKCE) and refresh_token
// grants for public clients. Accepts form encoding (the spec) and JSON.

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => typeof v === "string")
    ) as Record<string, string>;
  }
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  return params;
}

export async function POST(req: NextRequest) {
  if (await rateLimited(`oauth-token:${visitorHash(req)}`, { max: 30 })) {
    return Response.json(
      { error: "temporarily_unavailable", error_description: "Too many requests" },
      { status: 429, headers: { ...CORS, "Retry-After": "60" } }
    );
  }
  try {
    const params = await readParams(req);
    let tokens;
    if (params.grant_type === "authorization_code") {
      tokens = await exchangeAuthorizationCode(params);
    } else if (params.grant_type === "refresh_token") {
      tokens = await refreshAccessToken(params);
    } else {
      throw new OAuthError(OAuthErrorCode.UnsupportedGrantType, "Unsupported grant_type");
    }
    return Response.json(tokens, {
      headers: { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    if (OAuthError.isInstance(error)) {
      const status = error.code === OAuthErrorCode.InvalidClient ? 401 : 400;
      return Response.json(error.toResponseObject(), { status, headers: CORS });
    }
    return Response.json({ error: "server_error" }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
