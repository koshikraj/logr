import { NextRequest } from "next/server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createLogrMcpServer } from "@/lib/mcp";
import { rateLimited, visitorHash } from "@/lib/ratelimit";

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
  return handler.fetch(req);
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
