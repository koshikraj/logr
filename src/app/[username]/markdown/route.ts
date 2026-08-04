import { NextRequest } from "next/server";
import { profileMarkdownResponse } from "@/lib/markdown-context";

// Internal target for the public /[username].md rewrite.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  return profileMarkdownResponse(req, username);
}
