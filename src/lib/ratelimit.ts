import { createHash } from "crypto";

/**
 * Shared fixed-window rate limiter for public endpoints (chat, MCP).
 *
 * Durable when Upstash Redis is configured (UPSTASH_REDIS_REST_URL/_TOKEN) —
 * one window shared across all serverless instances. Falls back to a
 * per-instance in-memory window otherwise (dev, or deployments without
 * Redis). Redis failures fail open: availability of the public surface wins
 * over strict limiting.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const hits = new Map<string, { count: number; reset: number }>();

export async function rateLimited(
  key: string,
  { windowMs = 60_000, max = 12 }: { windowMs?: number; max?: number } = {}
): Promise<boolean> {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      // INCR + first-write EXPIRE = a fixed window per key.
      const res = await fetch(`${REDIS_URL}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
        body: JSON.stringify([
          ["INCR", `rl:${key}`],
          ["EXPIRE", `rl:${key}`, Math.ceil(windowMs / 1000), "NX"],
        ]),
        cache: "no-store",
      });
      if (res.ok) {
        const [first] = (await res.json()) as { result?: unknown }[];
        if (typeof first?.result === "number") return first.result > max;
      }
    } catch {
      /* fall through to the in-memory window */
    }
  }

  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  e.count += 1;
  return e.count > max;
}

/** Anonymous visitor key: hashed client IP, never the raw address. */
export function visitorHash(req: Request): string {
  const ipRaw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  return createHash("sha256").update(ipRaw).digest("hex").slice(0, 16);
}
