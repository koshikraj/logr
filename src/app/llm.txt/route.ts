import { NextRequest } from "next/server";
import { PRIMARY_USERNAME } from "@/lib/profile";
import { profileMarkdownResponse } from "@/lib/markdown-context";

// Legacy compatibility URL for the primary profile.
export async function GET(req: NextRequest) {
  return profileMarkdownResponse(req, PRIMARY_USERNAME);
}
