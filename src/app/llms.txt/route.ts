import { NextRequest } from "next/server";
import { profileMarkdownResponse } from "@/lib/markdown-context";

// Site-wide agent context is the dedicated public /logr profile.
export async function GET(req: NextRequest) {
  return profileMarkdownResponse(req, "logr", "primary");
}
