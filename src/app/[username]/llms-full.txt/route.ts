import { NextRequest } from "next/server";
import { profileMarkdownResponse } from "@/lib/markdown-context";

// Always serves the complete, unabridged Markdown profile.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  return profileMarkdownResponse(req, username);
}
