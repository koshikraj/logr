import { NextRequest } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth";
import { originFromRequest } from "@/lib/site";

// RFC 9728 Protected Resource Metadata for /mcp (path-inserted well-known
// location — the URL the 401 challenge's resource_metadata points at).

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
