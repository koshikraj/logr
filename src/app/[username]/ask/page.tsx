import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AskPage } from "@/components/AskPage";
import { getProfile } from "@/lib/profile";
import { isChatEnabled } from "@/lib/chat";
import { snippet } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

// Chat is gated on OPENROUTER_API_KEY in prod; available in dev for previewing.
function chatAvailable(): boolean {
  return isChatEnabled() || process.env.NODE_ENV !== "production";
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile || !chatAvailable()) notFound();
  const title = `ask ${profile.name.toLowerCase()} anything`;
  const description = `a grounded AI chat about ${profile.name} — ${snippet(profile.bio, 120)}`;
  return {
    title: { absolute: title },
    description,
    // functional twin of the profile page — shareable, but not indexed
    robots: { index: false, follow: true },
    alternates: { canonical: `/${username}/ask` },
    openGraph: { type: "website", url: `/${username}/ask`, siteName: "logr", title, description },
    twitter: { card: "summary_large_image", site: "@uselogr" },
  };
}

export default async function Ask({ params }: Params) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile || !chatAvailable()) notFound();
  return <AskPage profile={profile} />;
}
