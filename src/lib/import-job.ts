// Magical-onboarding job orchestrator: fans out over sources in parallel,
// persists every per-source result the moment it lands (that's the refresh
// durability layer), then runs a cross-source dedup/merge pass.

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/db";
import { CHAT_MODEL } from "@/lib/chat";
import { extractEvents, extractProfileFacts, EXTRACT_HINTS, type ProfileFacts } from "@/lib/extract";
import { insertEventsForProfile } from "@/lib/events";
import { crawlSite } from "@/lib/import-crawl";
import { classifySource } from "@/lib/import-classify";
import { fetchGithub, fetchRss, fetchDevto, fetchYoutube, fetchLinkedIn, isLinkedInApiEnabled } from "@/lib/import-sources";
import { detectPlatform, normalizeHref } from "@/lib/socials";
import type { ImportStreamEvent, ReviewEvent, SourceKind } from "@/lib/import-types";

export const MAX_SOURCES = 6; // user-pasted
export const MAX_DISCOVERED = 4; // auto-discovered on their site (depth 1)
export const MAX_FILES = 2;
export const MAX_EVENTS_PER_SOURCE = 20;
export const MAX_MERGED_EVENTS = 40;
export const JOB_TTL_MS = 24 * 60 * 60 * 1000;

export type JobInput = {
  sourceId: string;
  kind: SourceKind;
  url?: string;
  fileText?: string; // resume / linkedin-pdf: text extracted before the job starts
};

async function fetchSource(input: JobInput): Promise<{ text: string; external: string[] }> {
  switch (input.kind) {
    case "resume":
    case "linkedin-pdf":
      return { text: input.fileText ?? "", external: [] };
    case "github":
      return { text: await fetchGithub(input.url!), external: [] };
    case "rss":
      return { text: await fetchRss(input.url!), external: [] };
    case "devto":
      return { text: await fetchDevto(input.url!), external: [] };
    case "youtube":
      return { text: await fetchYoutube(input.url!), external: [] };
    case "linkedin":
      return { text: await fetchLinkedIn(input.url!), external: [] };
    case "site":
      return crawlSite(input.url!);
  }
}

/** Kinds we auto-follow when the person's own site links to them. "site" is
 *  excluded (no crawling arbitrary third-party sites, no loops). */
const DISCOVERABLE: ReadonlySet<SourceKind> = new Set(["github", "devto", "youtube", "rss"]);

/** Social-profile URL on an uncrawlable platform (x.com/user, instagram.com/
 *  user, linkedin.com/in/user) → candidate for the profile's social links. */
function socialProfileCandidate(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);
  if (host === "linkedin.com" && segs[0] === "in" && segs.length === 2) {
    return `https://linkedin.com/in/${segs[1]}`;
  }
  const PROFILE_HOSTS = new Set(["x.com", "twitter.com", "instagram.com", "tiktok.com", "threads.net"]);
  if (PROFILE_HOSTS.has(host) && segs.length === 1 && !/^(intent|share|search|home|hashtag)$/i.test(segs[0])) {
    const handle = segs[0].replace(/^@/, "");
    if (/^[\w.-]{1,40}$/.test(handle)) return `https://${host === "twitter.com" ? "x.com" : host}/${handle}`;
  }
  return null;
}

async function runSource(
  input: JobInput,
  emit: (e: ImportStreamEvent) => void
): Promise<{ events: ReviewEvent[]; text: string; external: string[] }> {
  const { sourceId } = input;
  try {
    await prisma.importSource.update({ where: { id: sourceId }, data: { status: "fetching" } });
    emit({ type: "source-status", sourceId, status: "fetching" });
    const { text, external } = await fetchSource(input);

    await prisma.importSource.update({ where: { id: sourceId }, data: { status: "extracting" } });
    emit({ type: "source-status", sourceId, status: "extracting" });
    const events = (await extractEvents(text, EXTRACT_HINTS[input.kind]))
      .slice(0, MAX_EVENTS_PER_SOURCE)
      .map((e) => ({ ...e, sourceUrl: input.url ?? null }));

    await prisma.importSource.update({
      where: { id: sourceId },
      data: { status: "done", events: JSON.stringify(events), eventCount: events.length },
    });
    emit({ type: "source-done", sourceId, events });
    return { events, text, external };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    await prisma.importSource
      .update({ where: { id: sourceId }, data: { status: "error", error: message.slice(0, 300) } })
      .catch(() => {});
    emit({ type: "source-error", sourceId, message });
    return { events: [], text: "", external: [] };
  }
}

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Fallback dedup when the merge model fails: same normalized title + year. */
function naiveDedup(events: ReviewEvent[]): ReviewEvent[] {
  const seen = new Map<string, ReviewEvent>();
  for (const e of events) {
    const key = `${normTitle(e.title)}|${e.dateOn.slice(0, 4)}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

function mergeGroup(group: ReviewEvent[]): ReviewEvent {
  const base = group.reduce((a, b) => (b.body.length > a.body.length ? b : a));
  const media = group.flatMap((e) => e.media);
  const uniqMedia = media.filter((m, i) => media.findIndex((x) => x.url === m.url) === i).slice(0, 8);
  return {
    ...base,
    dateOn: group.map((e) => e.dateOn).sort()[0],
    fullDate: group.some((e) => e.fullDate),
    featured: group.some((e) => e.featured),
    tags: [...new Set(group.flatMap((e) => e.tags))],
    sourceUrl: group.find((e) => e.sourceUrl)?.sourceUrl ?? null,
    media: uniqMedia,
  };
}

/** Cross-source dedup: the model only names duplicate index-groups; the actual
 *  merge is programmatic so already-resolved media survives untouched. */
async function mergeEvents(all: ReviewEvent[]): Promise<ReviewEvent[]> {
  let merged = all;
  try {
    const listing = all
      .map((e, i) => `${i}: ${e.dateOn} "${e.title}" — ${e.body.slice(0, 120)}`)
      .join("\n");
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
    const { text } = await generateText({
      model: openrouter.chat(process.env.OPENROUTER_MERGE_MODEL || CHAT_MODEL),
      system:
        "You find duplicate life/career events extracted from different sources about the same person. " +
        'Output ONLY raw JSON: {"groups":[[i,j,...],...]} where each group lists the indices of entries describing the SAME real-world event ' +
        "(e.g. the same job start appearing in both a resume and a website). Only include groups of 2+. No prose.",
      prompt: listing,
      temperature: 0,
    });
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    const groups = (JSON.parse(text.slice(a, b + 1)) as { groups?: unknown[] }).groups ?? [];
    const grouped = new Set<number>();
    const out: ReviewEvent[] = [];
    for (const g of groups) {
      if (!Array.isArray(g)) continue;
      const idx = g.filter((n): n is number => typeof n === "number" && n >= 0 && n < all.length && !grouped.has(n));
      if (idx.length < 2) continue;
      idx.forEach((n) => grouped.add(n));
      out.push(mergeGroup(idx.map((n) => all[n])));
    }
    all.forEach((e, i) => {
      if (!grouped.has(i)) out.push(e);
    });
    merged = out;
  } catch {
    merged = naiveDedup(all);
  }
  return merged.sort((x, y) => (x.dateOn < y.dateOn ? 1 : -1)).slice(0, MAX_MERGED_EVENTS);
}

/** The profile-link version of a source URL (feed URLs → the human page). */
function socialFromSource(input: JobInput): string | null {
  if (!input.url) return null;
  if (input.kind === "rss") {
    const m = /^https:\/\/medium\.com\/feed\/(@[^/]+)/.exec(input.url);
    if (m) return `https://medium.com/${m[1]}`;
    return input.url.replace(/\/(feed|rss|atom)\/?$/i, "") || null;
  }
  return input.url;
}

/** Insert the events + apply extracted bio/location/socials, then mark the
 *  job consumed. No-op when the profile doesn't exist (abandoned onboarding). */
async function autoPublish(
  userId: string,
  inputs: JobInput[],
  merged: ReviewEvent[],
  facts: ProfileFacts,
  extraSocials: string[]
) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true, bio: true, about: true, location: true, socials: true },
  });
  if (!profile) return false;

  await insertEventsForProfile(profile.id, merged);

  // Socials: existing (user-entered) + the pasted sources themselves + links
  // found in the sources. Dedupe on a canonical key (www./trailing-slash
  // variants collapse); existing entries win.
  const socialKey = (href: string) =>
    normalizeHref(href).toLowerCase().replace("://www.", "://").replace(/\/+$/, "");
  let existing: { label: string; href: string }[] = [];
  try {
    const v = JSON.parse(profile.socials || "[]");
    if (Array.isArray(v)) existing = v;
  } catch {
    /* rebuild below */
  }
  const socials = [...existing];
  const seen = new Set(existing.map((s) => socialKey(s.href)));
  for (const c of [
    ...inputs.map((i) => ({ label: "", href: socialFromSource(i) ?? "" })),
    ...extraSocials.map((href) => ({ label: "", href })),
    ...facts.socials,
  ]) {
    const href = normalizeHref(c.href);
    if (!href || seen.has(socialKey(href)) || socials.length >= 10) continue;
    seen.add(socialKey(href));
    socials.push({ label: c.label || detectPlatform(href), href });
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      // never overwrite what the user typed in onboarding — fill blanks only
      bio: profile.bio.trim() ? profile.bio : facts.bio ?? profile.bio,
      about: profile.about?.trim() ? profile.about : facts.about,
      location: profile.location.trim() ? profile.location : facts.location ?? profile.location,
      socials: JSON.stringify(socials),
    },
  });
  return true;
}

/** Run a whole import job, then auto-publish into the user's profile.
 *  Never throws — terminal state lands in the DB. */
export async function processJob(
  jobId: string,
  userId: string,
  inputs: JobInput[],
  emit: (e: ImportStreamEvent) => void
): Promise<void> {
  try {
    const wave1 = await Promise.all(inputs.map((input) => runSource(input, emit)));

    // Depth-1 discovery: the person's own site linked to their github/blog/
    // channel → fetch those too. Uncrawlable social profiles (x, instagram,
    // linkedin) become profile social links instead.
    const external = [...new Set(wave1.flatMap((r) => r.external))];
    const known = new Set(inputs.map((i) => i.url).filter(Boolean) as string[]);
    const discovered: { kind: SourceKind; url: string; label: string }[] = [];
    const extraSocials: string[] = [];
    for (const href of external) {
      const social = socialProfileCandidate(href);
      if (social) {
        if (!extraSocials.includes(social)) extraSocials.push(social);
        continue;
      }
      if (discovered.length >= MAX_DISCOVERED) continue;
      const c = classifySource(href);
      if (!c || !DISCOVERABLE.has(c.kind) || known.has(c.url)) continue;
      if (c.kind === "linkedin" && !isLinkedInApiEnabled()) continue;
      known.add(c.url);
      discovered.push(c);
    }

    let wave2: Awaited<ReturnType<typeof runSource>>[] = [];
    let discoveredInputs: JobInput[] = [];
    if (discovered.length) {
      const rows = await prisma.$transaction(
        discovered.map((d) =>
          prisma.importSource.create({ data: { jobId, kind: d.kind, url: d.url, label: d.label } })
        )
      );
      discoveredInputs = rows.map((row, i) => ({ sourceId: row.id, kind: discovered[i].kind, url: discovered[i].url }));
      wave2 = await Promise.all(discoveredInputs.map((input) => runSource(input, emit)));
    }

    const perSource = [...wave1, ...wave2];
    const allInputs = [...inputs, ...discoveredInputs];
    const all = perSource.flatMap((r) => r.events);

    const withEvents = perSource.filter((r) => r.events.length > 0).length;
    const [merged, facts] = await Promise.all([
      withEvents >= 2 ? mergeEvents(all) : Promise.resolve(all.slice(0, MAX_MERGED_EVENTS)),
      extractProfileFacts(perSource.map((r) => r.text).filter(Boolean).join("\n\n").slice(0, 12000)),
    ]);

    const published = await autoPublish(userId, allInputs, merged, facts, extraSocials);

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        mergedEvents: JSON.stringify(merged),
        consumedAt: published ? new Date() : null,
      },
    });
    emit({ type: "merged", events: merged });
    emit({ type: "done" });
  } catch {
    await prisma.importJob.update({ where: { id: jobId }, data: { status: "error" } }).catch(() => {});
    emit({ type: "done" });
  }
}
