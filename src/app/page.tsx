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
const FEATURED = [
  { handle: "hyddao", role: "community", word: "communities." },
  { handle: "avicii", role: "celebrity", word: "celebrities." },
  { handle: "sama", role: "techie", word: "techies." },
  { handle: "vitalik", role: "builder", word: "builders." },
];

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
  return FEATURED.flatMap(({ handle, role, word }) => {
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
