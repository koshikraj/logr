// Text → structured ReviewEvent[] extraction. Server-only (no "use server"
// directive so it can be imported by route handlers as well as actions).

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isChatEnabled, CHAT_MODEL } from "@/lib/chat";
import { buildNarratePrompt, parseNarrated } from "@/lib/narrate";
import { parseVideoUrl, parseTweetUrl, parseInstagramUrl } from "@/lib/video";
import { unfurl } from "@/lib/unfurl";
import type { MediaInput, ReviewEvent, SourceKind } from "@/lib/import-types";

/** Turn URLs from the narrative into media (tweet / video embed / link card). */
export async function resolveMedia(links: string[]): Promise<MediaInput[]> {
  const out: MediaInput[] = [];
  for (const url of links.slice(0, 4)) {
    if (parseTweetUrl(url)) {
      out.push({ kind: "tweet", url, poster: null, provider: "x", title: null });
      continue;
    }
    const ig = parseInstagramUrl(url);
    if (ig) {
      out.push({ kind: "instagram", url: ig.postUrl, poster: null, provider: "instagram", title: null });
      continue;
    }
    const v = parseVideoUrl(url);
    if (v) {
      out.push({ kind: "video", url: v.embedUrl, poster: v.poster, provider: v.provider, title: null });
      continue;
    }
    try {
      const u = await unfurl(url);
      out.push({ kind: "link", url, poster: u.poster, provider: u.provider, title: u.title });
    } catch {
      out.push({ kind: "link", url, poster: null, provider: null, title: url });
    }
  }
  return out;
}

/** Extra extraction rules per source kind, appended to the narrate prompt. */
export const EXTRACT_HINTS: Partial<Record<SourceKind, string>> = {
  github:
    "The text describes code repositories and releases. Extract project launches, releases, and notable milestones; tag them side_quest or work. Use each repo's created date when no better date exists, and put the repo URL in links.",
  rss:
    "The text lists blog posts with dates. Extract one `writing` event per notable post (skip trivial ones), using the post date and putting the post URL in links.",
  devto:
    "The text lists blog posts with dates. Extract one `writing` event per notable post (skip trivial ones), using the post date and putting the post URL in links.",
  youtube:
    "The text lists published videos with dates. Extract notable videos or talks as `talk` events, putting the video URL in links.",
  site:
    "The text comes from the person's own website. Extract projects, launches, roles, and talks; include project/page URLs in links.",
  resume:
    "The text is a resume/CV. Extract roles, education, and launches; use the start date of a date range as dateOn.",
  "linkedin-pdf":
    "The text is a LinkedIn profile export. Extract roles, education, and launches; use the start date of a date range as dateOn.",
  linkedin:
    "The text is structured LinkedIn profile data. Extract roles, education, certifications, projects, and notable recent posts (announcements, wins, talks — put the post URL in links); use the start date of a date range as dateOn.",
};

export type ProfileFacts = {
  bio: string | null;
  about: string | null;
  location: string | null;
  socials: { label: string; href: string }[];
};

/** Pull profile-level facts (one-line bio, longer about, location, social
 *  links) out of the combined source texts. Best-effort — empties on failure. */
export async function extractProfileFacts(text: string): Promise<ProfileFacts> {
  const none: ProfileFacts = { bio: null, about: null, location: null, socials: [] };
  if (!isChatEnabled() || !text.trim()) return none;
  try {
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
    const { text: out } = await generateText({
      model: openrouter.chat(CHAT_MODEL),
      system:
        "You output ONLY a raw JSON object — no prose, no markdown fences. " +
        'Shape: {"bio":string|null,"about":string|null,"location":string|null,"socials":[{"label":string,"href":string}]}. ' +
        "bio is ONE short line describing the person in their own voice (null if the text has nothing usable). " +
        "about is a warm 2–4 sentence first-person paragraph about who they are, what they work on, and what drives them — grounded ONLY in facts from the text, no invention, no dates-listing (null if too little material). " +
        "location is their city/country if stated, else null. " +
        "socials are the person's OWN profile links found in the text (x/twitter, github, linkedin, instagram, youtube, personal site, email) — full URLs only, no invented links.",
      prompt: text.slice(0, 10000),
      temperature: 0.3,
    });
    const a = out.indexOf("{");
    const b = out.lastIndexOf("}");
    if (a < 0 || b < 0) return none;
    const raw = JSON.parse(out.slice(a, b + 1)) as Partial<ProfileFacts>;
    const socials = (Array.isArray(raw.socials) ? raw.socials : [])
      .filter((s): s is { label: string; href: string } => typeof s?.href === "string")
      .map((s) => ({
        label: typeof s.label === "string" ? s.label.slice(0, 30) : "",
        href: s.href.trim(),
      }))
      .filter((s) => /^(https?:\/\/|mailto:)/.test(s.href) || /@/.test(s.href))
      .slice(0, 8);
    return {
      bio: typeof raw.bio === "string" && raw.bio.trim() ? raw.bio.trim().slice(0, 160) : null,
      about: typeof raw.about === "string" && raw.about.trim() ? raw.about.trim().slice(0, 800) : null,
      location: typeof raw.location === "string" && raw.location.trim() ? raw.location.trim().slice(0, 60) : null,
      socials,
    };
  } catch {
    return none;
  }
}

/** Extract structured events (with link/video/tweet media) from free text. */
export async function extractEvents(text: string, hint?: string): Promise<ReviewEvent[]> {
  if (!isChatEnabled()) throw new Error("Chat is not configured.");
  if (!text.trim()) return [];
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
  const { text: out } = await generateText({
    model: openrouter.chat(CHAT_MODEL),
    system:
      "You output ONLY a raw JSON object — no prose, no markdown fences, no commentary. " +
      'Shape: {"events":[{"dateOn":"YYYY-MM-DD","fullDate":boolean,"title":string,"tags":string[],"featured":boolean,"body":string,"icon":string,"links":string[]}]}. ' +
      "tags must be a subset of: work, milestone, talk, side_quest, writing. icon is one fitting emoji (or \"\"). links are full https URLs relevant to the event.",
    prompt: buildNarratePrompt(text.slice(0, 24000), hint),
    temperature: 0.2,
  });
  const parsed = parseNarrated(out);
  return Promise.all(
    parsed.map(async (e) => ({
      dateOn: e.dateOn,
      fullDate: e.fullDate,
      title: e.title,
      tags: e.tags,
      featured: e.featured,
      body: e.body,
      icon: e.icon || null,
      media: await resolveMedia(e.links),
    }))
  );
}
