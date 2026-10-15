// Resume builder (#66) — the ResumeDocument model, its validation, and the
// pure log → resume generator. No DB, no AI: everything here is
// deterministic so it can be unit-tested and shared by the server actions,
// the public /[username]/resume page, and the dashboard editor.

import { z } from "zod";
import type { EventDTO, ProfileDTO } from "@/lib/profile";

export const RESUME_TEMPLATES = ["classic", "modern", "founder", "academic", "creative"] as const;
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];
export const DEFAULT_RESUME_TEMPLATE: ResumeTemplate = "modern";

export const RESUME_PAGE_SIZES = ["A4", "Letter"] as const;
export type ResumePageSize = (typeof RESUME_PAGE_SIZES)[number];

export const SECTION_TYPES = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "talks",
  "writing",
  "achievements",
  "links",
  "custom",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TITLES: Record<SectionType, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  talks: "Talks",
  writing: "Writing",
  achievements: "Achievements",
  links: "Links",
  custom: "Section",
};

/** Default section order for a freshly generated resume. */
const SECTION_ORDER: SectionType[] = [
  "summary",
  "experience",
  "projects",
  "education",
  "achievements",
  "talks",
  "writing",
  "skills",
  "links",
];

// ---------- schema ----------

/** Only web and mail links are ever rendered — no javascript:, data:, etc. */
export function safeHref(href: string | null | undefined): string | null {
  const h = (href ?? "").trim();
  if (!h) return null;
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h.slice(0, 500);
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(h)) return `mailto:${h}`;
  return null;
}

/** "YYYY", "YYYY-MM", "YYYY-MM-DD", or "present" (dateTo only). */
const dateField = z
  .string()
  .regex(/^(\d{4}(-\d{2}(-\d{2})?)?|present)$/)
  .nullable();

const linkSchema = z.object({
  label: z.string().max(80),
  href: z.string().max(500),
});

/** Emoji/glyph, a Lucide icon key ("lucide:rocket"), or an image URL. */
const iconField = z.string().max(300).nullable();

export const resumeItemSchema = z.object({
  id: z.string().min(1).max(40),
  eventId: z.string().max(40).nullable(), // source event; null for free-form items
  title: z.string().max(200),
  subtitle: z.string().max(200).nullable(), // company / venue / degree
  location: z.string().max(120).nullable(),
  dateFrom: dateField,
  dateTo: dateField,
  bullets: z.array(z.string().max(400)).max(10),
  link: linkSchema.nullable(),
  icon: iconField,
  image: z.string().max(500).nullable(), // thumbnail (creative template)
});
export type ResumeItem = z.infer<typeof resumeItemSchema>;

export const resumeSectionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  title: z.string().max(80),
  icon: iconField,
  hidden: z.boolean(),
  text: z.string().max(2000).nullable(), // summary / free text sections
  items: z.array(resumeItemSchema).max(60),
});
export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export const resumeHeaderSchema = z.object({
  name: z.string().max(120),
  headline: z.string().max(200),
  location: z.string().max(120),
  email: z.string().max(200).nullable(),
  avatarUrl: z.string().max(500).nullable(),
  showAvatar: z.boolean(),
  links: z.array(linkSchema.extend({ icon: iconField })).max(12),
});
export type ResumeHeader = z.infer<typeof resumeHeaderSchema>;

export const resumeDocumentSchema = z.object({
  version: z.literal(1),
  header: resumeHeaderSchema,
  sections: z.array(resumeSectionSchema).max(20),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(), // overrides the profile palette accent
  // Events the owner removed from the resume — regenerate never re-adds them.
  excludedEventIds: z.array(z.string().max(40)).max(1000),
});
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

export type ResumeSettings = {
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  published: boolean;
};

/** Validate an untrusted document (editor save, DB read) and scrub hrefs. */
export function parseResumeDocument(value: unknown): ResumeDocument | null {
  const parsed = resumeDocumentSchema.safeParse(value);
  if (!parsed.success) return null;
  return sanitizeDocument(parsed.data);
}

function sanitizeDocument(doc: ResumeDocument): ResumeDocument {
  const cleanLink = <T extends { href: string }>(l: T | null): T | null => {
    const href = safeHref(l?.href);
    return l && href ? { ...l, href } : null;
  };
  const cleanUrl = (u: string | null) => (u && /^(https?:\/\/|\/)/.test(u) ? u : null);
  return {
    ...doc,
    header: {
      ...doc.header,
      avatarUrl: cleanUrl(doc.header.avatarUrl),
      links: doc.header.links.map(cleanLink).filter((l): l is NonNullable<typeof l> => !!l),
    },
    sections: doc.sections.map((s) => ({
      ...s,
      items: s.items.map((i) => ({ ...i, link: cleanLink(i.link), image: cleanUrl(i.image) })),
    })),
    excludedEventIds: Array.from(new Set(doc.excludedEventIds)),
  };
}

export function isResumeTemplate(v: unknown): v is ResumeTemplate {
  return typeof v === "string" && (RESUME_TEMPLATES as readonly string[]).includes(v);
}

export function isResumePageSize(v: unknown): v is ResumePageSize {
  return typeof v === "string" && (RESUME_PAGE_SIZES as readonly string[]).includes(v);
}

// ---------- generation ----------

/** Which resume section an event belongs in. Known tags first (in priority
 *  order, since events can carry several), then common custom tags. */
export function sectionTypeForTags(tags: string[]): SectionType {
  const t = new Set(tags.map((x) => x.toLowerCase()));
  if (t.has("work") || t.has("job") || t.has("role")) return "experience";
  if (t.has("education") || t.has("school") || t.has("degree") || t.has("course")) return "education";
  if (t.has("talk") || t.has("podcast")) return "talks";
  if (t.has("writing") || t.has("publication") || t.has("paper")) return "writing";
  if (t.has("side_quest") || t.has("project") || t.has("hackathon")) return "projects";
  return "achievements";
}

/** Split an event body into at most `max` resume bullets (sentence-ish). */
export function toBullets(body: string, max = 3): string[] {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.slice(0, max).map((s) => (s.length > 400 ? `${s.slice(0, 397)}…` : s));
}

/** Month precision unless the event records the exact day. */
function eventDate(e: EventDTO): string {
  return e.fullDate ? e.dateOn : e.dateOn.slice(0, 7);
}

function eventLink(e: EventDTO): ResumeItem["link"] {
  const href = safeHref(e.link?.href);
  if (e.link && href) return { label: e.link.label.slice(0, 80), href };
  const media = e.media.find((m) => m.kind === "link" && safeHref(m.url));
  return media ? { label: (media.title ?? media.provider ?? "Link").slice(0, 80), href: media.url } : null;
}

function eventImage(e: EventDTO): string | null {
  const m = e.media.find((x) => x.kind === "image") ?? e.media.find((x) => x.poster);
  const url = m ? (m.kind === "image" ? m.url : m.poster) : null;
  return url && /^(https?:\/\/|\/)/.test(url) ? url : null;
}

export function itemFromEvent(e: EventDTO): ResumeItem {
  return {
    id: `ev_${e.id}`.slice(0, 40),
    eventId: e.id,
    title: e.title.slice(0, 200),
    subtitle: null,
    location: null,
    dateFrom: eventDate(e),
    dateTo: null,
    bullets: toBullets(e.body),
    link: eventLink(e),
    icon: e.icon ? e.icon.slice(0, 300) : null,
    image: eventImage(e),
  };
}

function emptySection(type: SectionType): ResumeSection {
  return {
    id: `sec_${type}`,
    type,
    title: SECTION_TITLES[type],
    icon: null,
    hidden: false,
    text: null,
    items: [],
  };
}

function headerFromProfile(p: ProfileDTO): ResumeHeader {
  const email = p.socials.map((s) => s.href).find((h) => /^mailto:/i.test(h) || /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(h));
  return {
    name: p.name.slice(0, 120),
    headline: (p.status || p.bio).slice(0, 200),
    location: p.location.slice(0, 120),
    email: email ? email.replace(/^mailto:/i, "").slice(0, 200) : null,
    avatarUrl: p.avatarUrl,
    showAvatar: false,
    links: p.socials
      .filter((s) => !/^mailto:/i.test(s.href) && safeHref(s.href))
      .slice(0, 12)
      .map((s) => ({ label: s.label.slice(0, 80), href: s.href, icon: null })),
  };
}

/**
 * Build a complete resume from the log: header from the profile, a summary
 * from bio/about, and one section per event category. Events are already
 * reverse-chronological (position order), which is what resumes want too.
 */
export function generateResumeDocument(profile: ProfileDTO, excludedEventIds: string[] = []): ResumeDocument {
  const excluded = new Set(excludedEventIds);
  const byType = new Map<SectionType, ResumeSection>();
  const section = (type: SectionType) => {
    let s = byType.get(type);
    if (!s) byType.set(type, (s = emptySection(type)));
    return s;
  };

  const summary = [profile.about, profile.bio].map((v) => v?.trim()).find(Boolean);
  if (summary) section("summary").text = summary.slice(0, 2000);

  for (const e of profile.events) {
    if (excluded.has(e.id)) continue;
    section(sectionTypeForTags(e.tags)).items.push(itemFromEvent(e));
  }

  return {
    version: 1,
    header: headerFromProfile(profile),
    sections: SECTION_ORDER.filter((t) => byType.has(t)).map((t) => byType.get(t)!),
    accent: null,
    excludedEventIds: Array.from(excluded),
  };
}

/**
 * "Regenerate from log" without losing edits: existing items (and the
 * header, section order, titles, icons) are kept as the owner left them;
 * items whose event was deleted are dropped; events that are new to the log
 * (and not excluded) are added to their section, which is created if needed.
 */
export function mergeResumeDocument(current: ResumeDocument, profile: ProfileDTO): ResumeDocument {
  const fresh = generateResumeDocument(profile, current.excludedEventIds);
  const liveIds = new Set(profile.events.map((e) => e.id));
  const present = new Set(
    current.sections.flatMap((s) => s.items.map((i) => i.eventId)).filter((id): id is string => !!id)
  );

  const sections = current.sections.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.eventId || liveIds.has(i.eventId)),
  }));

  for (const fs of fresh.sections) {
    const additions = fs.items.filter((i) => i.eventId && !present.has(i.eventId));
    const target = sections.find((s) => s.type === fs.type);
    if (target) {
      // keep reverse-chron: new items slot in ahead of the first older one
      for (const item of additions) {
        const at = target.items.findIndex((i) => (i.dateFrom ?? "") < (item.dateFrom ?? ""));
        target.items.splice(at < 0 ? target.items.length : at, 0, item);
      }
      if (fs.type === "summary" && !target.text && fs.text) target.text = fs.text;
    } else if (additions.length) {
      // a removed summary stays removed; new categories go at the end
      sections.push({ ...fs, items: additions });
    }
  }

  return {
    ...current,
    sections,
    excludedEventIds: current.excludedEventIds.filter((id) => liveIds.has(id)),
  };
}

/**
 * Events the owner dropped between two saves become exclusions (so
 * regenerate won't resurrect them); events pulled back in are un-excluded.
 */
export function reconcileExclusions(previous: ResumeDocument | null, next: ResumeDocument): ResumeDocument {
  const ids = (d: ResumeDocument) =>
    new Set(d.sections.flatMap((s) => s.items.map((i) => i.eventId)).filter((id): id is string => !!id));
  const now = ids(next);
  const excluded = new Set(next.excludedEventIds.filter((id) => !now.has(id)));
  if (previous) for (const id of ids(previous)) if (!now.has(id)) excluded.add(id);
  return { ...next, excludedEventIds: Array.from(excluded) };
}

/** Pick a template from the shape of the log (used when AI is unavailable). */
export function suggestTemplate(doc: ResumeDocument): ResumeTemplate {
  const count = (t: SectionType) => doc.sections.find((s) => s.type === t)?.items.length ?? 0;
  const imageItems = doc.sections.flatMap((s) => s.items).filter((i) => i.image).length;
  if (count("talks") + count("writing") > count("experience") + count("projects")) return "academic";
  if (imageItems >= 4) return "creative";
  if (count("projects") > count("experience")) return "founder";
  return DEFAULT_RESUME_TEMPLATE;
}

// ---------- AI polish (proposal shape; generated in lib/resume-ai.ts) ----------

export type ResumePolish = {
  summary: string | null;
  template: ResumeTemplate;
  bullets: Record<string, string[]>; // item id → rewritten bullets
};

/** Apply a reviewed polish to a document (pure). */
export function applyPolish(doc: ResumeDocument, polish: ResumePolish): ResumeDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      text: s.type === "summary" && polish.summary ? polish.summary : s.text,
      items: s.items.map((i) => (polish.bullets[i.id] ? { ...i, bullets: polish.bullets[i.id] } : i)),
    })),
  };
}
