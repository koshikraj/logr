import "server-only";

import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/profile";
import { generateLlmTxt, generatePrimaryLlmsTxt } from "@/lib/llmtxt";

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate",
  // Markdown is an alternate representation of the canonical HTML profile.
  "X-Robots-Tag": "noindex",
} as const;

export async function profileMarkdownResponse(
  req: NextRequest,
  username: string,
  mode: "primary" | "full" = "full"
): Promise<Response> {
  const profile = await getProfile(username);
  if (!profile) return new Response("Not found", { status: 404 });

  const markdown = mode === "primary"
    ? generatePrimaryLlmsTxt(profile, req.nextUrl.origin)
    : generateLlmTxt(profile, req.nextUrl.origin);

  return new Response(markdown, { headers: MARKDOWN_HEADERS });
}
