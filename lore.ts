import "server-only";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/db";
import { CHAT_MODEL } from "@/lib/chat";

export const LORE_MAX_CHARS = 6000;
const MAX_EVENTS_IN_PROMPT = 120;

type LoreInput = {
  name: string;
  bio: string;
  status: string;
  location: string;
  about: string | null;
  socials: { label: string; href: string }[];
  events: {
    dateOn: string;
    title: string;
    body: string;
    tags: string[];
    featured: boolean;
    sources: string[];
  }[];
};

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function buildLorePrompt(p: LoreInput): string {
  const events = [...p.events]
    .sort((a, b) => (a.dateOn < b.dateOn ? -1 : 1))
    .slice(-MAX_EVENTS_IN_PROMPT)
    .map((e) => {
      const src = e.sources.map(hostOf).filter(Boolean);
      return `- ${e.dateOn} | ${e.title}${e.featured ? " ★" : ""} [${e.tags.join(",")}]${
        src.length ? ` (via ${[...new Set(src)].join(", ")})` : ""
      }\n  ${e.body.replace(/\s+/g, " ").slice(0, 300)}`;
    })
    .join("\n");

  return [
    `PERSON: ${p.name}`,
    p.bio && `BIO: ${p.bio}`,
    p.status && `CURRENTLY: ${p.status}`,
    p.location && `LOCATION: ${p.location}`,
    p.about && `ABOUT (owner-written):\n${p.about}`,
    p.socials.length && `PROFILES: ${p.socials.map((s) => `${s.label} ${s.href}`).join(" · ")}`,
    "",
    "EVENTS (oldest first):",
    events,
  ]
    .filter(Boolean)
    .join("\n");
}

const LORE_SYSTEM = [
  "You write the 'lore' of a person: a short narrative that connects their scattered public work into one story.",
  "Rules:",
  "- Use ONLY facts present in the input. Never invent employers, dates, numbers, awards or motives.",
  "- Find the throughlines: recurring themes, how one project led to the next, what they keep coming back to, how their focus shifted over time.",
  "- Cite concrete anchors (project names, years) from the events. Mention where the work shows up (GitHub, blog, X…) only when it adds meaning.",
  "- Third person, present tense for now, past tense for history. Plain, specific, warm; no hype, no buzzwords, no bullet points, no headings.",
  "- 3 to 5 short paragraphs separated by a blank line, 180–350 words total.",
  "- If the input is too thin for a story (fewer than 3 meaningful events), output exactly: INSUFFICIENT",
  "Output only the narrative text.",
].join("\n");

export async function generateLore(input: LoreInput): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  if (input.events.length < 3) return null;
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  const { text } = await generateText({
    model: openrouter.chat(process.env.OPENROUTER_LORE_MODEL || CHAT_MODEL),
    system: LORE_SYSTEM,
    prompt: buildLorePrompt(input),
    temperature: 0.4,
  });
  const out = text
    .replace(/```[a-z]*/gi, "")
    .replace(/```/g, "")
    .replace(/^#+\s.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!out || /^INSUFFICIENT\b/i.test(out)) return null;
  return out.slice(0, LORE_MAX_CHARS);
}

async function loadLoreInput(profileId: string): Promise<LoreInput | null> {
  const row = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      name: true,
      bio: true,
      status: true,
      location: true,
      about: true,
      socials: true,
      events: {
        orderBy: { dateOn: "asc" },
        select: {
          dateOn: true,
          title: true,
          body: true,
          tags: true,
          featured: true,
          sourceUrl: true,
          linkHref: true,
          media: { select: { url: true, kind: true } },
        },
      },
    },
  });
  if (!row) return null;
  let socials: { label: string; href: string }[] = [];
  try {
    const v = JSON.parse(row.socials || "[]");
    if (Array.isArray(v)) socials = v;
  } catch {
    /* ignore */
  }
  return {
    name: row.name,
    bio: row.bio,
    status: row.status,
    location: row.location,
    about: row.about,
    socials,
    events: row.events.map((e) => ({
      dateOn: e.dateOn,
      title: e.title,
      body: e.body,
      tags: e.tags,
      featured: e.featured,
      sources: [e.sourceUrl, e.linkHref, ...e.media.filter((m) => m.kind !== "image").map((m) => m.url)].filter(
        (u): u is string => !!u
      ),
    })),
  };
}

/** Synthesize and store lore for a profile.
 *  `force=false` never overwrites a hand-edited lore (lore set, loreAt null). */
export async function synthesizeLoreForProfile(
  profileId: string,
  { force = false }: { force?: boolean } = {}
): Promise<{ ok: true; lore: string } | { ok: false; reason: string }> {
  const current = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { lore: true, loreAt: true },
  });
  if (!current) return { ok: false, reason: "not_found" };
  if (!force && current.lore?.trim() && !current.loreAt) return { ok: false, reason: "hand_written" };

  const input = await loadLoreInput(profileId);
  if (!input) return { ok: false, reason: "not_found" };
  if (input.events.length < 3) return { ok: false, reason: "too_few_events" };

  const lore = await generateLore(input);
  if (!lore) return { ok: false, reason: "insufficient" };

  await prisma.profile.update({ where: { id: profileId }, data: { lore, loreAt: new Date() } });
  return { ok: true, lore };
}
