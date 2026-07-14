import type { Metadata } from "next";
import { Landing } from "@/components/marketing/Landing";
import type { FeaturedProfile } from "@/components/marketing/ProfileDeck";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: { absolute: "logr — the story a resume can't tell" },
  description:
    "A resume, LinkedIn, or bio can't tell your whole story — or speak to the agents now reading on someone's behalf. Log every event once: a timeline humans read and an llm.txt any agent can ingest.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "logr",
    title: "logr — the story a resume can't tell",
    description:
      "Log every event once: a timeline humans read and an llm.txt any agent can ingest.",
  },
};

// The "for anyone" spotlight: real logs, one per kind of person.
// Add a handle here and it appears on the landing once the profile has events.
// The rest of the deck auto-fills with the most-active public profiles.
const FEATURED = [
  { handle: "hyddao", role: "community", word: "communities." },
  { handle: "avicii", role: "celebrity", word: "celebrities." },
  { handle: "sama", role: "techie", word: "techies." },
  { handle: "vitalik", role: "builder", word: "builders." },
];

// Total cards in the deck (curated + auto-filled). Even, so the 2-col grid stays square.
const DECK_SIZE = 8;

async function loadFeatured(): Promise<FeaturedProfile[]> {
  const rows = await prisma.profile.findMany({
    where: { username: { in: FEATURED.map((f) => f.handle) }, events: { some: {} } },
    select: {
      username: true,
      name: true,
      avatarUrl: true,
      _count: { select: { events: true } },
    },
  });
  const byHandle = new Map(rows.map((r) => [r.username, r]));
  const curated = FEATURED.flatMap(({ handle, role, word }) => {
    const p = byHandle.get(handle);
    if (!p) return [];
    return [{
      username: p.username,
      name: p.name,
      role,
      word,
      avatarUrl: p.avatarUrl,
      events: p._count.events,
    }];
  });

  // Auto-fill the remaining slots with the most-active profiles. Same
  // visibility rule as /explore and the sitemap: owner-verified only. These
  // carry no `word`, so they join the grid without extending the headline loop.
  const extras = await prisma.profile.findMany({
    where: {
      claimStatus: { in: ["owned", "claimed"] },
      events: { some: {} },
      username: { notIn: FEATURED.map((f) => f.handle) },
    },
    select: {
      username: true,
      name: true,
      avatarUrl: true,
      _count: { select: { events: true } },
    },
    orderBy: [{ events: { _count: "desc" } }, { updatedAt: "desc" }],
    take: Math.max(0, DECK_SIZE - curated.length),
  });

  // Curated first — ProfileDeck maps rotation slots onto the leading cards.
  return [
    ...curated,
    ...extras.map((p) => ({
      username: p.username,
      name: p.name,
      avatarUrl: p.avatarUrl,
      events: p._count.events,
    })),
  ];
}

// Reads the session and featured profiles, so render per-request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [signedIn, featured] = await Promise.all([
    getUserId().then(Boolean),
    loadFeatured(),
  ]);
  return <Landing signedIn={signedIn} featured={featured} />;
}
