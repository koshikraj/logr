import { NextRequest } from "next/server";
import { OAuthError } from "@modelcontextprotocol/server";
import { registerClient } from "@/lib/oauth";
import { rateLimited, visitorHash } from "@/lib/ratelimit";

// Dynamic Client Registration (RFC 7591). Public PKCE clients only — no
// secrets are issued, so registration is open but rate-limited.

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export async function POST(req: NextRequest) {
  if (await rateLimited(`oauth-reg:${visitorHash(req)}`, { max: 10 })) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Too many registrations" },
      { status: 429, headers: CORS }
    );
  }
  let metadata: Record<string, unknown>;
  try {
    metadata = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON" },
      { status: 400, headers: CORS }
    );
  }
  try {
    const client = await registerClient(metadata);
    return Response.json(client, { status: 201, headers: CORS });
  } catch (error) {
    if (OAuthError.isInstance(error)) {
      return Response.json(error.toResponseObject(), { status: 400, headers: CORS });
    }
    return Response.json({ error: "server_error" }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
