import type { ProfileDTO } from "@/lib/profile";
import { SITE_URL } from "@/lib/site";

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
