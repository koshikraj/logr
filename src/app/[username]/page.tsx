import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PortfolioPage } from "@/components/PortfolioPage";
import { LiveBuilding } from "@/components/LiveBuilding";
import { profileBuildStatusAction } from "@/lib/actions";
import { getProfile } from "@/lib/profile";
import { profileJsonLd, snippet, hasIndexSubstance } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  // 404 here too: metadata resolves before the page body, and a plain `{}`
  // lets streaming commit a 200 status before the page's own notFound() runs.
  if (!profile) notFound();

  // Title carries what people search next to a name: the status line (or bio).
  const tail = snippet(profile.status || profile.bio, 60);
  const title = tail ? `${profile.name} — ${tail}` : profile.name;
  const description = snippet(profile.bio, 160);
  const [firstName, ...restName] = profile.name.trim().split(/\s+/);

  const meta: Metadata = {
    // absolute: a person's page is their brand; skip the "· logr" suffix
    title: { absolute: title },
    description,
    alternates: {
      canonical: `/${username}`,
      // the machine-readable twin — linked for agents, noindexed for crawlers
      types: { "text/plain": `/${username}/llm.txt` },
    },
    openGraph: {
      type: "profile",
      url: `/${username}`,
      siteName: "logr",
      title,
      description,
      firstName,
      lastName: restName.join(" ") || undefined,
      username,
    },
    // metadata merging is shallow per top-level field — restate `site` here
    twitter: { card: "summary_large_image", site: "@uselogr" },
  };
  // unclaimed seeded profiles stay out of search indexes until claimed
  if (profile.claimStatus === "published") meta.robots = { index: false, follow: false };
  // thin/test profiles are noindexed (still followable) until they have
  // an identity line and a real log — mirrors the sitemap's filter
  else if (!hasIndexSubstance({ bio: profile.bio, status: profile.status, eventCount: profile.events.length }))
    meta.robots = { index: false, follow: true };
  return meta;
}

export default async function UserPortfolio({ params }: Params) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  // Freshly onboarded and the background import is still assembling the
  // timeline → render the real page in live-building mode: a status strip
  // narrates the parsing and events pop in as sources complete.
  const build = await profileBuildStatusAction(username);
  if (build?.status === "running") return <LiveBuilding profile={profile} initial={build} />;
  // Person structured data only on owner-verified pages — seeded-unclaimed
  // profiles are noindexed and shouldn't assert facts about real people.
  const jsonLd = profile.claimStatus !== "published" ? profileJsonLd(profile) : null;
  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
      <PortfolioPage profile={profile} />
    </>
  );
}
