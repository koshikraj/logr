import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Mark } from "@/components/Mark";
import { snippet } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "explore",
  description:
    "People logging their work and life on logr — browse public timelines, each readable by humans and askable by agents.",
  alternates: { canonical: "/explore" },
  openGraph: {
    type: "website",
    url: "/explore",
    siteName: "logr",
    title: "explore · logr",
    description: "People logging their work and life on logr — browse public timelines.",
  },
};

// The public directory: real internal links so profile pages aren't orphans.
// Same visibility rule as the sitemap — owner-verified profiles only.
export default async function ExplorePage() {
  const profiles = await prisma.profile.findMany({
    // same rule as the sitemap: only profiles with something to read
    where: { claimStatus: { in: ["owned", "claimed"] }, events: { some: {} } },
    select: {
      username: true,
      name: true,
      bio: true,
      status: true,
      location: true,
      avatarUrl: true,
      _count: { select: { events: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="explore">
      <div className="explore__page">
        <header className="explore__bar">
          <Link href="/" className="explore__brand">
            <Mark />
            logr<span className="explore__colon">:</span>
          </Link>
          <Link href="/login" className="explore__cta">
            start your log
          </Link>
        </header>

        <h1 className="explore__title">
          people on logr<span className="explore__colon">.</span>
        </h1>
        <p className="explore__sub">
          {profiles.length} public {profiles.length === 1 ? "log" : "logs"} — each one a timeline
          humans read and agents can just ask.
        </p>

        <ul className="explore__grid">
          {profiles.map((p) => (
            <li key={p.username}>
              <Link href={`/${p.username}`} className="explore__card">
                <span className="explore__avatar">
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt={p.name} loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{p.name.charAt(0).toLowerCase()}</span>
                  )}
                </span>
                <span className="explore__copy">
                  <span className="explore__name">{p.name}</span>
                  <span className="explore__handle">
                    @{p.username}
                    {p.location ? ` · ${p.location}` : ""}
                  </span>
                  {(p.status || p.bio) && (
                    <span className="explore__bio">{snippet(p.status || p.bio, 90)}</span>
                  )}
                  <span className="explore__count">
                    {p._count.events} {p._count.events === 1 ? "event" : "events"} logged
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="explore__foot">
          <Link href="/">← what is logr?</Link>
        </footer>
      </div>
    </div>
  );
}
