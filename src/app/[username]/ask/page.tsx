import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AskPage } from "@/components/AskPage";
import { getProfile } from "@/lib/profile";
import { isChatEnabled } from "@/lib/chat";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

// Chat is gated on OPENROUTER_API_KEY in prod; available in dev for previewing.
function chatAvailable(): boolean {
  return isChatEnabled() || process.env.NODE_ENV !== "production";
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile || !chatAvailable()) return {};
  const title = `ask ${profile.name} anything`;
  const description = `a grounded AI chat about ${profile.name} — answers drawn only from their recorded log.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Ask({ params }: Params) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  // No chat configured → no page to show.
  if (!chatAvailable()) notFound();
  return <AskPage profile={profile} />;
}
