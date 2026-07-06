import { NextRequest } from "next/server";
import { getProfile } from "@/lib/profile";
import { generateLlmTxt } from "@/lib/llmtxt";

// Serves /[username]/llm.txt — the machine-readable context file per profile.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(generateLlmTxt(profile, req.nextUrl.origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate",
      // unverified auto-generated bios of real people stay out of search indexes
      ...(profile.claimStatus === "published" ? { "X-Robots-Tag": "noindex" } : {}),
    },
  });
}
