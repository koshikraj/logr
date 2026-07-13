import { NextRequest } from "next/server";
import { getProfile, PRIMARY_USERNAME } from "@/lib/profile";
import { generateLlmTxt } from "@/lib/llmtxt";

// Serves /llm.txt for the primary (single-user) profile.
export async function GET(req: NextRequest) {
  const profile = await getProfile(PRIMARY_USERNAME);
  if (!profile) {
    return new Response("Not found", { status: 404 });
  }
  const origin = req.nextUrl.origin;
  return new Response(generateLlmTxt(profile, origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate",
      // plain-text twin of the profile page — linked for agents, not indexed
      "X-Robots-Tag": "noindex",
    },
  });
}
