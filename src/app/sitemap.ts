import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { hasIndexSubstance } from "@/lib/seo";

// Rebuilt hourly — new and freshly-edited profiles show up without a deploy.
export const revalidate = 3600;

// Only owner-verified profiles with real substance are listed. Seeded
// profiles (draft/published/takedown) stay out: published ones are noindexed
// on the page, and a sitemap entry would contradict that signal. Thin/test
// profiles (no bio/status, or a near-empty log) are likewise noindexed on
// the page — hasIndexSubstance keeps the two signals in lockstep.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const candidates = await prisma.profile.findMany({
    where: { claimStatus: { in: ["owned", "claimed"] } },
    select: {
      username: true,
      updatedAt: true,
      bio: true,
      status: true,
      _count: { select: { events: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const profiles = candidates.filter((p) =>
    hasIndexSubstance({ bio: p.bio, status: p.status, eventCount: p._count.events })
  );

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    ...profiles.map((p) => ({
      url: `${SITE_URL}/${p.username}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
