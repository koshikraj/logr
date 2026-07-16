// Magical-onboarding per-platform fetchers (server-only — pulls in undici).
// URL classification lives in the client-safe src/lib/import-classify.ts.
// Every fetch of a user-controlled host goes through guardedFetch (SSRF rule);
// fixed-host APIs (api.github.com, dev.to) use plain fetch by construction.

import { guardedFetch } from "@/lib/import";

const MAX_FACT_CHARS = 12000;

// ---------- fetchers (each returns normalized fact text) ----------

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "logr-import/1.0",
  };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function ghJson(path: string): Promise<unknown> {
  // Fixed host — SSRF-safe by construction; do not route user URLs here.
  const res = await fetch(`https://api.github.com${path}`, {
    headers: ghHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error("GitHub rate limit hit — try again in a few minutes.");
  }
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  return res.json();
}

type GhRepo = {
  name: string; description: string | null; html_url: string; homepage: string | null;
  created_at: string; pushed_at: string; stargazers_count: number; fork: boolean;
};

export async function fetchGithub(url: string): Promise<string> {
  const user = new URL(url).pathname.split("/").filter(Boolean)[0];
  if (!user || !/^[a-zA-Z0-9-]{1,39}$/.test(user)) throw new Error("Could not read a GitHub username from that URL.");
  const u = encodeURIComponent(user);

  const profile = (await ghJson(`/users/${u}`)) as {
    name: string | null; bio: string | null; blog: string | null; created_at: string;
    location: string | null; html_url: string; public_repos: number;
  };
  const repos = ((await ghJson(`/users/${u}/repos?sort=pushed&per_page=30`)) as GhRepo[])
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10);

  const lines: string[] = [
    `GitHub profile of ${profile.name ?? user} (${profile.html_url}), joined ${profile.created_at.slice(0, 10)}.`,
  ];
  if (profile.bio) lines.push(`Bio: ${profile.bio}`);
  lines.push("", "Top repositories (own work, by stars):");
  for (const r of repos) {
    lines.push(
      `- ${r.name} — ${r.description ?? "no description"} | created ${r.created_at.slice(0, 10)} | ${r.stargazers_count} stars | ${r.html_url}${r.homepage ? ` | site: ${r.homepage}` : ""}`
    );
  }

  // Releases for the top few repos — real, dated "launch" events.
  for (const r of repos.slice(0, 3)) {
    try {
      const rels = (await ghJson(`/repos/${u}/${encodeURIComponent(r.name)}/releases?per_page=5`)) as Array<{
        name: string | null; tag_name: string; published_at: string | null; html_url: string;
      }>;
      if (rels.length) {
        lines.push("", `Releases of ${r.name}:`);
        for (const rel of rels) {
          lines.push(`- ${rel.name || rel.tag_name} on ${rel.published_at?.slice(0, 10) ?? "unknown date"} | ${rel.html_url}`);
        }
      }
    } catch {
      // releases are a bonus — ignore per-repo failures
    }
  }
  return lines.join("\n").slice(0, MAX_FACT_CHARS);
}

/** Minimal RSS/Atom parsing — enough for post titles/dates/links, no new dep. */
export async function fetchRss(feedUrl: string): Promise<string> {
  const { body } = await guardedFetch(feedUrl);
  const items: string[] = [];
  const strip = (s: string) =>
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#?\w+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const pick = (block: string, tag: string) =>
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1] ?? "";

  const blocks = body.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  for (const block of blocks.slice(0, 20)) {
    const title = strip(pick(block, "title"));
    if (!title) continue;
    const date = strip(pick(block, "pubDate") || pick(block, "published") || pick(block, "updated"));
    // Atom <link href="..."/> is self-closing; RSS <link> wraps the URL.
    const link =
      /<link[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ?? strip(pick(block, "link"));
    const desc = strip(pick(block, "description") || pick(block, "summary")).slice(0, 200);
    items.push(`- "${title}" published ${date || "unknown date"} | ${link}${desc ? ` | ${desc}` : ""}`);
  }
  if (!items.length) throw new Error("No posts found in that feed.");
  return [`Published posts from ${feedUrl}:`, ...items].join("\n").slice(0, MAX_FACT_CHARS);
}

export async function fetchDevto(url: string): Promise<string> {
  const user = new URL(url).pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
  if (!user) throw new Error("Could not read a dev.to username from that URL.");
  // Fixed host — SSRF-safe by construction.
  const res = await fetch(`https://dev.to/api/articles?username=${encodeURIComponent(user)}&per_page=20`, {
    headers: { "user-agent": "logr-import/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`dev.to returned ${res.status}.`);
  const posts = (await res.json()) as Array<{
    title: string; url: string; published_at: string; description: string; positive_reactions_count: number;
  }>;
  if (!posts.length) throw new Error("No dev.to posts found for that user.");
  const lines = posts.map(
    (p) => `- "${p.title}" published ${p.published_at?.slice(0, 10)} | ${p.url} | ${p.description?.slice(0, 200) ?? ""}`
  );
  return [`dev.to posts by @${user}:`, ...lines].join("\n").slice(0, MAX_FACT_CHARS);
}

export async function fetchYoutube(url: string): Promise<string> {
  const u = new URL(url);
  const segs = u.pathname.split("/").filter(Boolean);
  let channelId = segs[0] === "channel" ? segs[1] : null;
  if (!channelId) {
    // Resolve @handle / legacy /c/ pages to a channel id via the page source.
    const { body } = await guardedFetch(u.toString());
    channelId = /"channelId"\s*:\s*"(UC[\w-]+)"/.exec(body)?.[1] ?? null;
  }
  if (!channelId || !/^UC[\w-]{10,}$/.test(channelId)) {
    throw new Error("Could not find that YouTube channel.");
  }
  return fetchRss(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
}

// ---------- LinkedIn (env-gated third-party adapter) ----------

/** Paste-URL LinkedIn import needs a configured provider (e.g. Bright Data,
 *  ScrapIn). Without one we ask for the profile's PDF export instead. */
export function isLinkedInApiEnabled(): boolean {
  return Boolean(process.env.LINKEDIN_API_URL && process.env.LINKEDIN_API_KEY);
}

export async function fetchLinkedIn(profileUrl: string): Promise<string> {
  if (!isLinkedInApiEnabled()) {
    throw new Error("LinkedIn import isn't configured — upload your LinkedIn PDF export instead.");
  }
  const endpoint = `${process.env.LINKEDIN_API_URL}${process.env.LINKEDIN_API_URL!.includes("?") ? "&" : "?"}url=${encodeURIComponent(profileUrl)}`;
  const res = await fetch(endpoint, {
    headers: { authorization: `Bearer ${process.env.LINKEDIN_API_KEY}`, accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`LinkedIn provider returned ${res.status}.`);
  const data = await res.json();
  // Flatten arbitrary provider JSON into indented fact lines.
  const lines: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (lines.length > 400 || v == null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, path ? `${path}.${k}` : k));
    else lines.push(`${path}: ${String(v).slice(0, 300)}`);
  };
  walk(data, "");
  return [`LinkedIn profile data for ${profileUrl}:`, ...lines].join("\n").slice(0, MAX_FACT_CHARS);
}
