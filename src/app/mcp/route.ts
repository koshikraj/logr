import { NextRequest } from "next/server";
import {
  createMcpHandler,
  verifyBearerToken,
  bearerAuthChallengeResponse,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { createLogrMcpServer } from "@/lib/mcp";
import { tokenVerifier } from "@/lib/oauth";
import { rateLimited, visitorHash } from "@/lib/ratelimit";
import { originFromRequest } from "@/lib/site";

export const dynamic = "force-dynamic";

// Stateless Streamable HTTP MCP endpoint (issue #58): a fresh per-request
// server instance from the shared factory; legacy (2025-era) clients are
// served through the SDK's stateless fallback, so no session state exists on
// any path — safe under serverless scale-out.
const handler = createMcpHandler((ctx) => createLogrMcpServer(ctx));

const MAX_BODY_BYTES = 128 * 1024;
const MAX_PER_MINUTE = 60;

async function serve(req: NextRequest): Promise<Response> {
  if (await rateLimited(`mcp:${visitorHash(req)}`, { max: MAX_PER_MINUTE })) {
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  // Reads are public; a Bearer token (when presented) is verified and unlocks
  // the owner write tools. Invalid tokens get the RFC 9728 challenge so
  // spec-compliant clients can discover the authorization server.
  let authInfo: AuthInfo | undefined;
  const authorization = req.headers.get("authorization");
  if (authorization) {
    try {
      authInfo = await verifyBearerToken(authorization, { verifier: tokenVerifier });
    } catch (error) {
      return bearerAuthChallengeResponse(error, {
        resourceMetadataUrl: `${originFromRequest(req)}/.well-known/oauth-protected-resource/mcp`,
      });
    }
  }

  return handler.fetch(req, { authInfo });
}

export async function POST(req: NextRequest) {
  return serve(req);
}

// GET/DELETE are 2025-era session operations; the stateless handler answers
// them itself (405). Forwarded so the protocol error shape stays the SDK's.
export async function GET(req: NextRequest) {
  return serve(req);
}

export async function DELETE(req: NextRequest) {
  return serve(req);
}
