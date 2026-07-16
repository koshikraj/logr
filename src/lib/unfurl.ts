// Best-effort Open Graph "unfurl": turn a URL into a link card (title, image,
// site name). Server-side only. Falls back to the hostname when scraping fails
// (paywalls, JS-only pages, bot blocks) so the card is always usable.

import { guardedFetch } from "@/lib/import";

export type Unfurled = { title: string; poster: string | null; provider: string };

const decode = (s: string | null) =>
  s
    ? s
        .replace(/&amp;/g, "&")
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
    : null;

export async function unfurl(rawUrl: string): Promise<Unfurled> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) URLs");
  const host = u.hostname.replace(/^www\./, "");

  let html = "";
  try {
    // SSRF-guarded — these URLs are user-influenced (pasted links, model output).
    const { body } = await guardedFetch(u.toString());
    html = body.slice(0, 600_000); // cap parse size
  } catch {
    return { title: host, poster: null, provider: host };
  }

  const meta = (key: string): string | null => {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, "i").exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i").exec(html);
    return a?.[1] ?? b?.[1] ?? null;
  };

  const title =
    decode(meta("og:title") ?? meta("twitter:title")) ||
    decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? null) ||
    host;

  let poster = decode(meta("og:image") ?? meta("og:image:url") ?? meta("twitter:image"));
  if (poster?.startsWith("//")) poster = u.protocol + poster;
  else if (poster?.startsWith("/")) poster = u.origin + poster;
  if (poster && !/^https?:\/\//.test(poster)) poster = null;

  const provider = decode(meta("og:site_name")) || host;

  return { title: title.slice(0, 180), poster, provider: provider.slice(0, 60) };
}
