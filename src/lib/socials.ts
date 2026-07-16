// Predictive socials parsing.
//
// Users paste one link per line — just the URL is enough; the platform label
// (and therefore the icon) is derived from the host. A "Label url" line still
// works for custom names. Parsing is tolerant (strips stray <>, collapses the
// historical doubled-token corruption, auto-adds https://mailto:) and the
// parse → serialize → parse round-trip is idempotent, which is what prevents
// the old duplication loop.

import type { Social } from "./profile";

// Known hosts → canonical platform key. Keys must match SOCIAL_ICONS in the UI.
const HOSTS: Record<string, string> = {
  "x.com": "x",
  "twitter.com": "x",
  "github.com": "github",
  "linkedin.com": "linkedin",
  "instagram.com": "instagram",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "calendly.com": "calendly",
  "t.me": "telegram",
  "telegram.me": "telegram",
  "wa.me": "whatsapp",
  "whatsapp.com": "whatsapp",
  "api.whatsapp.com": "whatsapp",
  "chat.whatsapp.com": "whatsapp",
  "peerlist.io": "peerlist",
  "topmate.io": "topmate",
  "dev.to": "dev.to",
  "producthunt.com": "producthunt",
  "patreon.com": "patreon",
  "daily.dev": "daily.dev",
  "app.daily.dev": "daily.dev",
};

/** Derive a canonical platform label from a normalized href. */
export function detectPlatform(href: string): string {
  if (/^mailto:/i.test(href)) return "email";
  let host = "";
  try {
    host = new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "link";
  }
  if (HOSTS[host]) return HOSTS[host];
  // Fallback: the registrable-ish label, e.g. "myblog.com" -> "myblog".
  const parts = host.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : host || "link";
}

function isLinkish(t: string): boolean {
  return (
    /^(https?:\/\/|mailto:)/i.test(t) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || // bare email
    /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(t) // bare domain, optional path
  );
}

/** Turn a single token into a valid href (or "" if it can't be one). */
export function normalizeHref(token: string): string {
  let h = token.trim().replace(/^[<(]+|[>)]+$/g, "").trim();
  if (!h) return "";
  if (/^mailto:/i.test(h)) return h;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h)) return `mailto:${h}`;
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
  try {
    // Drop a dangling "?"/"#" (empty query/fragment, often from truncated paste).
    return new URL(h).toString().replace(/[?#]+$/, "");
  } catch {
    return "";
  }
}

function parseLine(line: string): Social | null {
  // Drop the angle-bracket placeholders users copy from the field hint, then
  // collapse runs of identical tokens (the old "<X> <url> <X> <url>" doubling).
  const tokens = line
    .replace(/[<>]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t, i, a) => i === 0 || t !== a[i - 1]);
  if (tokens.length === 0) return null;

  let urlIdx = tokens.findIndex(isLinkish);
  if (urlIdx === -1) urlIdx = tokens.length - 1; // no obvious link: treat last token as one

  const href = normalizeHref(tokens[urlIdx]);
  if (!href) return null;

  const label = tokens.slice(0, urlIdx).join(" ").trim();
  return { label: label || detectPlatform(href), href };
}

/** Parse the socials textarea (one entry per line) into clean Social[]. */
export function parseSocials(raw: string): Social[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((s): s is Social => s !== null);
}

/**
 * Serialize Social[] back to textarea text. Auto-derivable labels collapse to
 * just the URL, so re-parsing yields the same data (idempotent).
 */
export function serializeSocials(socials: Social[]): string {
  return socials
    .map((s) =>
      s.label && s.label.toLowerCase() !== detectPlatform(s.href)
        ? `${s.label} ${s.href}`
        : s.href
    )
    .join("\n");
}

/** Repair possibly-corrupt stored socials by running them back through the parser. */
export function healSocials(socials: Social[]): Social[] {
  return parseSocials(serializeSocials(socials));
}
