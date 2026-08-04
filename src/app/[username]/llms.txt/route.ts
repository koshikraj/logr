import { NextRequest } from "next/server";
import { profileMarkdownResponse } from "@/lib/markdown-context";

// Primary agent context: complete for ordinary profiles, concise discovery
// with links to full Markdown representations for oversized profiles.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  return profileMarkdownResponse(req, username, "primary");
}
