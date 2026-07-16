// Pasted-URL → source classification. Client-safe (no node imports) so the
// onboarding UI can render chips instantly; the server re-classifies anyway.

import { normalizeHref } from "@/lib/socials";
import type { SourceKind } from "@/lib/import-types";

export type ClassifiedSource = { kind: SourceKind; url: string; label: string };

/** Hosts we can't crawl (JS shells / bot-blocked) and have no free API for. */
const UNCRAWLABLE_HOSTS = new Set([
  "x.com", "twitter.com", "instagram.com", "facebook.com", "tiktok.com", "threads.net",
]);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function labelFor(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return (u.hostname.replace(/^www\./i, "") + path).slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

/** True when the URL points at a platform we can't ingest at all. */
export function isUncrawlable(rawUrl: string): boolean {
  const href = normalizeHref(rawUrl);
  return !!href && UNCRAWLABLE_HOSTS.has(hostOf(href));
}

/** Classify a pasted URL into a fetchable source. Returns null for
 *  unparseable input, mailto:, and uncrawlable social platforms. */
export function classifySource(rawUrl: string): ClassifiedSource | null {
  const href = normalizeHref(rawUrl);
  if (!href || /^mailto:/i.test(href)) return null;
  const host = hostOf(href);
  if (!host || UNCRAWLABLE_HOSTS.has(host)) return null;

  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const segs = u.pathname.split("/").filter(Boolean);

  if (host === "github.com" || host === "gist.github.com") {
    const user = segs[0]?.replace(/^@/, "");
    if (!user) return null;
    return { kind: "github", url: `https://github.com/${user}`, label: `github.com/${user}` };
  }
  if (host === "linkedin.com") {
    return { kind: "linkedin", url: href, label: labelFor(href) };
  }
  if (host === "medium.com") {
    const user = segs[0]?.startsWith("@") ? segs[0] : null;
    if (user) return { kind: "rss", url: `https://medium.com/feed/${user}`, label: `medium.com/${user}` };
    return { kind: "site", url: href, label: labelFor(href) };
  }
  if (host.endsWith(".medium.com") || host.endsWith(".substack.com")) {
    return { kind: "rss", url: `${u.origin}/feed`, label: host };
  }
  if (host === "dev.to") {
    const user = segs[0]?.replace(/^@/, "");
    if (user && segs.length === 1) return { kind: "devto", url: `https://dev.to/${user}`, label: `dev.to/${user}` };
    return { kind: "site", url: href, label: labelFor(href) };
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (segs[0]?.startsWith("@") || segs[0] === "channel" || segs[0] === "c" || segs[0] === "user") {
      return { kind: "youtube", url: href, label: labelFor(href) };
    }
    return null; // a single video/short isn't a source
  }
  if (/\.(rss|xml|atom)$/i.test(u.pathname) || /\/(feed|rss|atom)\/?$/i.test(u.pathname)) {
    return { kind: "rss", url: href, label: labelFor(href) };
  }
  return { kind: "site", url: href, label: labelFor(href) };
}
