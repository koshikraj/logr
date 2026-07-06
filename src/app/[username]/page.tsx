import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PortfolioPage } from "@/components/PortfolioPage";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  // 404 here too: metadata resolves before the page body, and a plain `{}`
  // lets streaming commit a 200 status before the page's own notFound() runs.
  if (!profile) notFound();
  const meta: Metadata = {
    title: `${profile.name} — a record, latest first`,
    description: profile.bio.replace(/\n/g, " "),
  };
  meta.twitter = { card: "summary_large_image" };
  // unclaimed seeded profiles stay out of search indexes until claimed
  if (profile.claimStatus === "published") meta.robots = { index: false, follow: false };
  return meta;
}

export default async function UserPortfolio({ params }: Params) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  return <PortfolioPage profile={profile} />;
}
