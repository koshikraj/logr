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

// ---------- Bright Data Web Scraper API (LinkedIn + X/Twitter) ----------
//
// Paste-URL LinkedIn and X profile imports are powered by Bright Data's
// pre-built scrapers (docs.brightdata.com/datasets/scrapers). Gated on
// BRIGHTDATA_API_KEY — without it LinkedIn falls back to the PDF export and
// X links are declined. Fixed api.brightdata.com host: SSRF-safe by
// construction.

const BD_BASE = "https://api.brightdata.com/datasets/v3";
const BD_LINKEDIN_DATASET = "gd_l1viktl72bvl7bjuj0"; // LinkedIn people profiles
const BD_X_PROFILE_DATASET = "gd_lwxmeb2u1cniijd7t4"; // X (Twitter) profiles
const BD_X_POSTS_DATASET = "gd_lwxkxvnf1cynvib9co"; // X (Twitter) posts (discover by profile)
const BD_DEADLINE_MS = 240_000; // fresh scrapes take ~30–90s; stay under route maxDuration
const BD_POLL_MS = 8_000;
const X_POSTS_LIMIT = 12;

export function isBrightDataEnabled(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_KEY);
}

/** @deprecated alias kept for call-site clarity around the LinkedIn gate */
export const isLinkedInApiEnabled = isBrightDataEnabled;

function bdHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
    "content-type": "application/json",
  };
}

/** Async fallback: poll a snapshot until ready, then download its records. */
async function bdSnapshot(snapshotId: string, deadline: number): Promise<unknown> {
  for (;;) {
    if (Date.now() > deadline) throw new Error("LinkedIn scrape timed out — try again in a few minutes.");
    const prog = await fetch(`${BD_BASE}/progress/${encodeURIComponent(snapshotId)}`, {
      headers: bdHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!prog.ok) throw new Error(`Bright Data returned ${prog.status} while polling.`);
    const { status } = (await prog.json()) as { status?: string };
    if (status === "ready") break;
    if (status === "failed") throw new Error("Bright Data couldn't read that LinkedIn profile.");
    await new Promise((r) => setTimeout(r, BD_POLL_MS));
  }
  const snap = await fetch(`${BD_BASE}/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {
    headers: bdHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!snap.ok) throw new Error(`Bright Data returned ${snap.status} for the snapshot.`);
  return snap.json();
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const objList = (v: unknown) =>
  (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []) as Record<string, unknown>[];

/** Shape a Bright Data people-profile record into dated fact text. Falls back
 *  to a generic flatten when the record doesn't match the known schema. */
export function formatLinkedInRecord(r: Record<string, unknown>, profileUrl: string): string {
  const lines: string[] = [`LinkedIn profile: ${profileUrl}`];
  const name = str(r.name);
  const headline = str(r.position) ?? str(r.headline);
  if (name) lines.push(`Name: ${name}${headline ? ` — ${headline}` : ""}`);
  const loc = [str(r.city), str(r.location), str(r.country_code)].filter(Boolean).join(", ");
  if (loc) lines.push(`Location: ${loc}`);
  const about = str(r.about) ?? str(r.summary);
  if (about) lines.push(`About: ${about.slice(0, 800)}`);
  const cc = (r.current_company ?? {}) as Record<string, unknown>;
  const current = [str(cc.title), str(cc.name)].filter(Boolean).join(" at ");
  if (current) lines.push(`Currently: ${current}`);

  const sect = (label: string, items: Record<string, unknown>[], fmt: (e: Record<string, unknown>) => string | null) => {
    const rows = items.map(fmt).filter((x): x is string => !!x).slice(0, 12);
    if (rows.length) lines.push("", `${label}:`, ...rows);
  };
  sect("Experience", objList(r.experience), (e) => {
    const what = [str(e.title), str(e.company)].filter(Boolean).join(" at ");
    if (!what) return null;
    const when = [str(e.start_date), str(e.end_date)].filter(Boolean).join(" — ") || str(e.duration) || "dates unknown";
    const desc = str(e.description) ?? str(e.description_html);
    return `- ${what} | ${when}${desc ? ` | ${desc.slice(0, 200)}` : ""}`;
  });
  sect("Education", objList(r.education), (e) => {
    const what = [str(e.degree), str(e.field), str(e.title)].filter(Boolean).join(", ");
    if (!what) return null;
    const when = [str(e.start_year), str(e.end_year)].filter(Boolean).join(" — ");
    return `- ${what}${when ? ` | ${when}` : ""}`;
  });
  // some profiles come back with education:null but a plain-text summary
  if (!objList(r.education).length && str(r.educations_details)) {
    lines.push("", `Education: ${str(r.educations_details)}`);
  }
  sect("Certifications", objList(r.certifications), (e) => {
    const what = [str(e.title), str(e.subtitle)].filter(Boolean).join(" — ");
    // issue date lives in `meta`, e.g. "Issued Nov 2017 See credential"
    const issued = /issued\s+([A-Za-z]{3,9}\s+\d{4})/i.exec(str(e.meta) ?? "")?.[1];
    return what ? `- ${what}${issued ? ` | issued ${issued}` : ""}` : null;
  });
  sect("Honors & awards", objList(r.honors_and_awards), (e) => {
    const what = [str(e.title), str(e.publication)].filter(Boolean).join(" — ");
    return what ? `- ${what}${str(e.date) ? ` | ${str(e.date)}` : ""}` : null;
  });
  sect("Projects", objList(r.projects), (e) => {
    const what = str(e.title);
    if (!what) return null;
    const when = [str(e.start_date), str(e.end_date)].filter(Boolean).join(" — ");
    const desc = str(e.description);
    return `- ${what}${when ? ` | ${when}` : ""}${desc ? ` | ${desc.slice(0, 160)}` : ""}`;
  });
  // recent posts/activity — the freshest signal on most profiles
  sect("Recent posts and activity", objList(r.activity), (e) => {
    const title = str(e.title);
    if (!title) return null;
    const link = str(e.link);
    return `- ${title.slice(0, 220)}${link ? ` | ${link}` : ""}`;
  });

  // Unknown schema → generic flatten so odd records still yield something.
  if (lines.length < 4) {
    const walk = (v: unknown, path: string) => {
      if (lines.length > 400 || v == null) return;
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, path ? `${path}.${k}` : k));
      else lines.push(`${path}: ${String(v).slice(0, 300)}`);
    };
    walk(r, "");
  }
  return lines.join("\n").slice(0, MAX_FACT_CHARS);
}

/** Synchronous scrape — "one request, one response", Bright Data's
 *  recommended mode for single-URL real-time lookups. Falls back to
 *  snapshot polling when the response is a pointer instead of records. */
async function bdScrape(datasetId: string, input: Record<string, unknown>, params = ""): Promise<unknown> {
  const deadline = Date.now() + BD_DEADLINE_MS;
  const res = await fetch(`${BD_BASE}/scrape?dataset_id=${datasetId}&format=json${params}`, {
    method: "POST",
    headers: bdHeaders(),
    body: JSON.stringify([input]),
    signal: AbortSignal.timeout(BD_DEADLINE_MS),
  });
  if (res.status === 401 || res.status === 403) throw new Error("Bright Data rejected the API key.");
  if (!res.ok) throw new Error(`Bright Data returned ${res.status}.`);
  const data: unknown = await res.json();
  const snapshotId = str((data as Record<string, unknown>)?.snapshot_id);
  if (snapshotId) return bdSnapshot(snapshotId, deadline);
  return data;
}

/** Asynchronous collection (trigger → poll → snapshot) for jobs the sync
 *  endpoint won't do fully, like discovering a profile's recent posts. */
async function bdTrigger(datasetId: string, input: Record<string, unknown>, params = ""): Promise<unknown> {
  const deadline = Date.now() + BD_DEADLINE_MS;
  const res = await fetch(`${BD_BASE}/trigger?dataset_id=${datasetId}&format=json${params}`, {
    method: "POST",
    headers: bdHeaders(),
    body: JSON.stringify([input]),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error("Bright Data rejected the API key.");
  if (!res.ok) throw new Error(`Bright Data returned ${res.status}.`);
  const snapshotId = str(((await res.json()) as Record<string, unknown>)?.snapshot_id);
  if (!snapshotId) throw new Error("Bright Data did not return a snapshot id.");
  return bdSnapshot(snapshotId, deadline);
}

export async function fetchLinkedIn(profileUrl: string): Promise<string> {
  if (!isBrightDataEnabled()) {
    throw new Error("LinkedIn import isn't configured — upload your LinkedIn PDF export instead.");
  }
  const data = await bdScrape(BD_LINKEDIN_DATASET, { url: profileUrl });
  const record = Array.isArray(data) ? data[0] : data;
  if (!record || typeof record !== "object") throw new Error("Bright Data returned no profile data.");
  return formatLinkedInRecord(record as Record<string, unknown>, profileUrl);
}

// ---------- X (Twitter) ----------

/** Shape an X profile record + discovered posts into dated fact text. */
export function formatTwitterRecord(
  r: Record<string, unknown>,
  posts: Record<string, unknown>[],
  profileUrl: string
): string {
  const lines: string[] = [`X (Twitter) profile: ${profileUrl}`];
  const handle = /(?:x|twitter)\.com\/(@?[\w.-]+)/i.exec(profileUrl)?.[1];
  const name = str(r.profile_name) ?? str(r.name);
  if (name) lines.push(`Name: ${name}${handle ? ` (@${handle.replace(/^@/, "")})` : ""}`);
  if (str(r.biography)) lines.push(`Bio: ${str(r.biography)}`);
  if (str(r.location)) lines.push(`Location: ${str(r.location)}`);
  if (str(r.external_link)) lines.push(`Website: ${str(r.external_link)}`);
  if (str(r.date_joined)) lines.push(`Joined: ${str(r.date_joined)!.slice(0, 10)}`);
  if (typeof r.followers === "number") lines.push(`Followers: ${r.followers} · posts: ${r.posts_count ?? "?"}`);

  const own = posts.filter((p) => p.is_repost !== true && str(p.description));
  if (own.length) {
    lines.push("", "Recent posts:");
    for (const p of own.slice(0, X_POSTS_LIMIT)) {
      const date = str(p.date_posted)?.slice(0, 10) ?? "unknown date";
      const url = str(p.url)?.replace("twitter.com", "x.com");
      lines.push(`- ${date} | ${str(p.description)!.slice(0, 240).replace(/\s+/g, " ")}${url ? ` | ${url}` : ""}`);
    }
  }
  return lines.join("\n").slice(0, MAX_FACT_CHARS);
}

export async function fetchTwitter(profileUrl: string): Promise<{ text: string; external: string[] }> {
  if (!isBrightDataEnabled()) {
    throw new Error("X import isn't configured.");
  }
  // Profile (sync) and recent posts (async discovery) in parallel — posts are
  // a bonus: if discovery times out, the profile alone still yields facts.
  const [profile, posts] = await Promise.all([
    bdScrape(BD_X_PROFILE_DATASET, { url: profileUrl }),
    bdTrigger(
      BD_X_POSTS_DATASET,
      { url: profileUrl },
      `&type=discover_new&discover_by=profile_url&limit_per_input=${X_POSTS_LIMIT}`
    ).catch(() => []),
  ]);
  const record = Array.isArray(profile) ? profile[0] : profile;
  if (!record || typeof record !== "object") throw new Error("Bright Data returned no profile data.");
  const rec = record as Record<string, unknown>;
  const postList = (Array.isArray(posts) ? posts : []).filter(
    (p): p is Record<string, unknown> => !!p && typeof p === "object"
  );
  // the bio's website link is the person's own site — prime discovery material
  const site = str(rec.external_link);
  return {
    text: formatTwitterRecord(rec, postList, profileUrl),
    external: site && /^https?:\/\//.test(site) ? [site] : [],
  };
}
