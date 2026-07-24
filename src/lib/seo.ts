import type { ProfileDTO } from "@/lib/profile";
import { SITE_URL } from "@/lib/site";

/**
 * Substance gate shared by the sitemap and per-page robots meta: a profile
 * earns search indexing once it has an identity line (bio or status) AND at
 * least MIN_INDEX_EVENTS logged events. Below that it reads as a thin/test/
 * duplicate page and drags the whole site's quality signal — so it stays
 * live and crawlable but noindexed, and flips indexable the moment the
 * owner gives it substance. (Seeded-unclaimed pages are gated separately.)
 */
export const MIN_INDEX_EVENTS = 2;
export function hasIndexSubstance(p: {
  bio: string | null;
  status: string | null;
  eventCount: number;
}): boolean {
  return p.eventCount >= MIN_INDEX_EVENTS && Boolean(p.bio?.trim() || p.status?.trim());
}

/** Trim to a search-snippet-friendly length on a word boundary. */
export function snippet(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 16)).trimEnd()}…`;
}

/**
 * schema.org ProfilePage + Person JSON-LD for a profile. The `sameAs` social
 * URLs are what lets search engines connect the page to the person's existing
 * entity (GitHub, X, LinkedIn…). Only call this for owner-verified profiles —
 * unclaimed seeded pages are noindexed and must not assert structured facts
 * about real people.
 */
export function profileJsonLd(profile: ProfileDTO): string {
  const url = `${SITE_URL}/${profile.username}`;
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE_URL}${u}`);

  const person: Record<string, unknown> = {
    "@type": "Person",
    name: profile.name,
    alternateName: `@${profile.username}`,
    url,
    description: snippet(profile.bio, 300),
  };
  if (profile.avatarUrl) person.image = abs(profile.avatarUrl);
  if (profile.location) person.address = profile.location;
  const sameAs = profile.socials
    .map((s) => s.href)
    .filter((h) => /^https?:\/\//.test(h));
  if (sameAs.length) person.sameAs = sameAs;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
    dateModified: profile.updatedAt,
    url,
  };
  // `<` escaped so the payload can't close its own <script> tag.
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}
