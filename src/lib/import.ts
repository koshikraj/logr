import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// ---------- SSRF GUARD ----------
//
// Block private/internal/metadata addresses to prevent the server from being
// used as a proxy into the internal network. Validation happens at *connect*
// time inside undici's lookup hook — not at URL-parse time — so DNS rebinding
// and HTTP redirects to internal hosts are both caught.

const PRIVATE_V4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],          // "this network"
  ["10.0.0.0", 8],         // RFC1918 private
  ["100.64.0.0", 10],      // CGNAT
  ["127.0.0.0", 8],        // loopback
  ["169.254.0.0", 16],     // link-local — includes 169.254.169.254 (cloud metadata)
  ["172.16.0.0", 12],      // RFC1918 private
  ["192.0.0.0", 24],       // IETF protocol assignments
  ["192.168.0.0", 16],     // RFC1918 private
  ["198.18.0.0", 15],      // benchmark
  ["224.0.0.0", 4],        // multicast
  ["240.0.0.0", 4],        // reserved
];

function ipv4ToInt(ip: string): number {
  const p = ip.split(".").map(Number);
  return p[0] * 0x1000000 + (p[1] << 16) + (p[2] << 8) + p[3];
}

function isPrivateIPv4(ip: string): boolean {
  const v = ipv4ToInt(ip);
  for (const [range, bits] of PRIVATE_V4_CIDRS) {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((v & mask) === (ipv4ToInt(range) & mask)) return true;
  }
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::ffff:a.b.c.d — IPv4-mapped (dotted form)
  const dotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return isPrivateIPv4(dotted[1]);
  // ::ffff:WXYZ:ABCD — IPv4-mapped after Node's URL parser normalization
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
    return isPrivateIPv4(`${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`);
  }
  if (lower === "::" || lower === "::1") return true;       // unspecified, loopback
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;         // fc00::/7 ULA
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;         // fe80::/10 link-local
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;            // ff00::/8 multicast
  return false;
}

function isPrivateIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isPrivateIPv4(ip);
  if (fam === 6) return isPrivateIPv6(ip);
  return true; // unknown family — refuse
}

// Build a per-request agent whose lookup validates every resolved address.
// Closure-scoped flags let us distinguish SSRF blocks from real DNS failures —
// undici wraps lookup-callback errors in ways that strip the original details.
//
// Undici calls lookup with `{ all: true }` and expects the callback to receive
// (err, LookupAddress[]) — NOT the standard `(err, address, family)` shape that
// `node:net`'s LookupFunction type advertises. We forward the requested options
// to `dns.lookup` so it returns the right shape, then filter out private IPs.
function buildGuardedAgent() {
  const state = { blocked: false, notFound: false };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lookup: any = (hostname: string, options: any, callback: any) => {
    dnsLookup(hostname, options, (err, result) => {
      if (err) { state.notFound = true; return callback(err); }
      const addrs = (Array.isArray(result) ? result : [{ address: result as string, family: 4 }]) as Array<{ address: string; family: number }>;
      if (!addrs.length) { state.notFound = true; return callback(new Error("ENOTFOUND")); }
      const safe = addrs.filter((a) => !isPrivateIp(a.address));
      if (!safe.length) { state.blocked = true; return callback(new Error("blocked")); }
      if (options?.all) return callback(null, safe);
      callback(null, safe[0].address, safe[0].family);
    });
  };
  const agent = new Agent({
    connect: { lookup },
    bodyTimeout: 12_000,
    headersTimeout: 12_000,
  });
  return { agent, state };
}

// ---------- TEXT EXTRACTORS ----------

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text.replace(/\s{3,}/g, "\n\n").trim();
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer });
  return value.replace(/\s{3,}/g, "\n\n").trim();
}

/** SSRF-guarded fetch of a user-supplied URL. ALL outbound requests to
 *  user-controlled hosts must go through this (project rule). */
export async function guardedFetch(url: string): Promise<{ body: string; contentType: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  // If the user passed an IP literal, undici may skip our lookup hook — check up front.
  const hostNoBrackets = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostNoBrackets) && isPrivateIp(hostNoBrackets)) {
    throw new Error("That URL is not accessible.");
  }

  const { agent, state } = buildGuardedAgent();
  try {
    // Use undici's fetch (not global fetch) so our Agent is recognized — Node's
    // built-in fetch may use a different undici version internally.
    const res = await undiciFetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; logr-import/1.0)" },
      signal: AbortSignal.timeout(12_000),
      dispatcher: agent,
    });
    if (!res.ok) throw new Error(`Could not fetch page (${res.status}).`);
    const body = await res.text();
    return { body, contentType: res.headers.get("content-type") ?? "" };
  } catch (e) {
    if (state.blocked) throw new Error("That URL is not accessible.");
    if (state.notFound) throw new Error("Could not resolve that host.");
    if (e instanceof Error && e.message.startsWith("Could not fetch page")) throw e;
    throw new Error("Could not fetch that page.");
  } finally {
    void agent.close();
  }
}

export async function fetchUrlText(url: string): Promise<string> {
  const { body } = await guardedFetch(url);
  return htmlToText(body);
}

/** Fetch a page and return both its readable text and its links (extracted
 *  before htmlToText strips <nav>/<header>). For the site crawler. */
export async function fetchUrlPage(url: string): Promise<{ text: string; links: PageLink[] }> {
  const { body } = await guardedFetch(url);
  return { text: htmlToText(body), links: htmlToLinks(body, url) };
}

export type PageLink = { href: string; text: string; external: boolean };

/** Extract <a href> links from raw HTML, resolved and deduped — same-origin
 *  AND external (externals feed source discovery + event/media links). */
export function htmlToLinks(html: string, baseUrl: string): PageLink[] {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }
  const out: PageLink[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 80) {
    const raw = (m[1] ?? m[2] ?? "").replace(/&amp;/g, "&").trim();
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript):/i.test(raw)) continue;
    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(resolved.protocol)) continue;
    resolved.hash = "";
    if (seen.has(resolved.href)) continue;
    seen.add(resolved.href);
    const label = m[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    out.push({ href: resolved.href, text: label, external: resolved.origin !== origin });
  }
  return out;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 14000);
}
