import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// Rebuilt hourly — new and freshly-edited profiles show up without a deploy.
export const revalidate = 3600;

// Only owner-verified profiles are listed. Seeded profiles (draft/published/
// takedown) stay out: published ones are noindexed on the page, and a sitemap
// entry would contradict that signal.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const profiles = await prisma.profile.findMany({
    // empty profiles are thin content — list them once they log something
    where: { claimStatus: { in: ["owned", "claimed"] }, events: { some: {} } },
    select: { username: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

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
