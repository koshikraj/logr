import { NextRequest } from "next/server";
import { authorizationServerMetadata } from "@/lib/oauth";
import { originFromRequest } from "@/lib/site";

// RFC 8414 Authorization Server Metadata — MCP clients discover the
// authorize/token/register endpoints here.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-protocol-version",
} as const;

export async function GET(req: NextRequest) {
  return Response.json(authorizationServerMetadata(originFromRequest(req)), {
    headers: { ...CORS, "Cache-Control": "public, max-age=3600" },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
