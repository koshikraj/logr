/** Canonical site origin — the single source for absolute URLs in metadata,
 *  sitemap, robots, and JSON-LD. Set NEXT_PUBLIC_SITE_URL to override
 *  (no trailing slash); production canonicals must always point here, never
 *  at preview deployment hosts. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://logr.it"
).replace(/\/+$/, "");

/** Public origin for a request. Honors the proxy headers Vercel sets;
 *  falls back to the canonical site URL when no request is available. */
export function originFromRequest(req: Request | undefined): string {
  if (!req) return SITE_URL;
  try {
    const url = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
    return `${proto}://${host}`;
  } catch {
    return SITE_URL;
  }
}
