/** Canonical site origin — the single source for absolute URLs in metadata,
 *  sitemap, robots, and JSON-LD. Set NEXT_PUBLIC_SITE_URL to override
 *  (no trailing slash); production canonicals must always point here, never
 *  at preview deployment hosts. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://logr.it"
).replace(/\/+$/, "");
