import { NextRequest } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth";
import { originFromRequest } from "@/lib/site";

// Root-location fallback of the RFC 9728 document — some clients probe
// /.well-known/oauth-protected-resource without the resource path suffix.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-protocol-version",
} as const;

export async function GET(req: NextRequest) {
  return Response.json(protectedResourceMetadata(originFromRequest(req)), {
    headers: { ...CORS, "Cache-Control": "public, max-age=3600" },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
