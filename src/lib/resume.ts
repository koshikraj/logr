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

/** Target page count (#68): the draft is fitted to it; the sheet tightens to it. */
export const RESUME_PAGE_COUNTS = [1, 2, 3, 4] as const;
export type ResumePageCount = (typeof RESUME_PAGE_COUNTS)[number];
export const DEFAULT_RESUME_PAGES: ResumePageCount = 2;

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

/** Document limits — the generator clamps to these so generated documents
 *  always validate; the editor surfaces them before the server rejects. */
export const RESUME_LIMITS = {
  sections: 30,
  itemsPerSection: 200,
  bulletsPerItem: 10,
  headerLinks: 12,
  excludedEventIds: 5000,
  url: 500,
} as const;

const MAX_URL = RESUME_LIMITS.url;

/** Only web and mail links are ever rendered — no javascript:, data:, etc. */
export function safeHref(href: string | null | undefined): string | null {
  const h = (href ?? "").trim();
  if (!h) return null;
  if (h.length > MAX_URL) return null; // a truncated URL is a broken URL
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
  if (EMAIL_RE.test(h)) return `mailto:${h}`;
  return null;
}

const EMAIL_RE = /^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/;

/** Image/thumbnail URLs: absolute http(s) or site-relative, within length. */
export function safeImageUrl(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  return u && u.length <= MAX_URL && /^(https?:\/\/|\/(?!\/))/i.test(u) ? u : null;
}

/** "YYYY", "YYYY-MM", or "YYYY-MM-DD" with a real month/day. */
const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const dateFrom = z.string().regex(DATE_RE).nullable();
/** dateTo additionally allows "present". */
const dateTo = z.union([z.string().regex(DATE_RE), z.literal("present")]).nullable();

const linkSchema = z.object({
  label: z.string().max(80),
  href: z.string().max(MAX_URL),
});

/** Emoji/glyph, a Lucide icon key ("lucide:rocket"), or an image URL. */
const iconField = z.string().max(300).nullable();

export const resumeItemSchema = z.object({
  id: z.string().min(1).max(40),
  eventId: z.string().max(40).nullable(), // source event; null for free-form items
  title: z.string().max(200),
  subtitle: z.string().max(200).nullable(), // company / venue / degree
  location: z.string().max(120).nullable(),
  dateFrom,
  dateTo,
  bullets: z.array(z.string().max(400)).max(RESUME_LIMITS.bulletsPerItem),
  link: linkSchema.nullable(),
  icon: iconField,
  image: z.string().max(MAX_URL).nullable(), // thumbnail (creative template)
});
export type ResumeItem = z.infer<typeof resumeItemSchema>;

export const resumeSectionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
  title: z.string().max(80),
  icon: iconField,
  hidden: z.boolean(),
  text: z.string().max(2000).nullable(), // summary / free text sections
  items: z.array(resumeItemSchema).max(RESUME_LIMITS.itemsPerSection),
});
export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export const resumeHeaderSchema = z.object({
  name: z.string().max(120),
  headline: z.string().max(200),
  location: z.string().max(120),
  email: z.string().max(200).nullable(),
  avatarUrl: z.string().max(MAX_URL).nullable(),
  showAvatar: z.boolean(),
  links: z.array(linkSchema.extend({ icon: iconField })).max(RESUME_LIMITS.headerLinks),
});
export type ResumeHeader = z.infer<typeof resumeHeaderSchema>;

export const resumeDocumentSchema = z.object({
  version: z.literal(1),
  header: resumeHeaderSchema,
  sections: z.array(resumeSectionSchema).max(RESUME_LIMITS.sections),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(), // overrides the profile palette accent
  // Events the owner removed from the resume — regenerate never re-adds them.
  excludedEventIds: z.array(z.string().max(40)).max(RESUME_LIMITS.excludedEventIds),
});
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

export type ResumeSettings = {
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  pages: ResumePageCount;
  published: boolean;
};

/** Validate an untrusted document (editor save, DB read) and scrub hrefs. */
export function parseResumeDocument(value: unknown): ResumeDocument | null {
  const res = validateResumeDocument(value);
  return res.ok ? res.document : null;
}

/** Like parseResumeDocument, but says what's wrong (for editor errors). */
export function validateResumeDocument(
  value: unknown
): { ok: true; document: ResumeDocument } | { ok: false; error: string } {
  const parsed = resumeDocumentSchema.safeParse(value);
  if (parsed.success) return { ok: true, document: sanitizeDocument(parsed.data) };
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? issue.path.join(".") : "document";
  return { ok: false, error: `Invalid resume (${where}): ${issue?.message ?? "unknown error"}` };
}

function sanitizeDocument(doc: ResumeDocument): ResumeDocument {
  const cleanLink = <T extends { href: string }>(l: T | null): T | null => {
    const href = safeHref(l?.href);
    return l && href ? { ...l, href } : null;
  };
  return {
    ...doc,
    header: {
      ...doc.header,
      avatarUrl: safeImageUrl(doc.header.avatarUrl),
      links: doc.header.links.map(cleanLink).filter((l): l is NonNullable<typeof l> => !!l),
    },
    sections: doc.sections.map((s) => ({
      ...s,
      items: s.items.map((i) => ({ ...i, link: cleanLink(i.link), image: safeImageUrl(i.image) })),
    })),
    excludedEventIds: Array.from(new Set(doc.excludedEventIds)),
  };
}

export function isResumeTemplate(v: unknown): v is ResumeTemplate {
  return typeof v === "string" && (RESUME_TEMPLATES as readonly string[]).includes(v);
}

export function isResumePageCount(v: unknown): v is ResumePageCount {
  return typeof v === "number" && (RESUME_PAGE_COUNTS as readonly number[]).includes(v);
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
    .replace(/([.!?])\s+(?=[A-Z0-9"“(])/g, "$1\u0000")
    .split("\u0000")
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.slice(0, max).map((s) => (s.length > 400 ? `${s.slice(0, 397)}…` : s));
}

/** Month precision unless the event records the exact day; null if malformed. */
function eventDate(e: EventDTO): string | null {
  const d = e.fullDate ? e.dateOn : e.dateOn.slice(0, 7);
  if (DATE_RE.test(d)) return d;
  const year = e.dateOn.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Decode the HTML entities unfurled page titles carry ("Bengaluru&#x27;s"). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** A short link label: the given text when it reads like a label, else the
 *  hostname (unfurled page titles are often "post | Name | 12 comments"). */
export function linkLabel(text: string | null | undefined, href: string): string {
  const t = decodeEntities(text ?? "").replace(/\s+/g, " ").trim();
  if (t && t.length <= 40 && !t.includes(" | ")) return t;
  if (/^mailto:/i.test(href)) return href.slice(7, 87);
  try {
    return new URL(href).hostname.replace(/^www\./, "").slice(0, 80);
  } catch {
    return t.slice(0, 80) || "Link";
  }
}

function eventLink(e: EventDTO): ResumeItem["link"] {
  const href = safeHref(e.link?.href);
  if (e.link && href) return { label: linkLabel(e.link.label, href), href };
  for (const m of e.media) {
    const mediaHref = m.kind === "link" ? safeHref(m.url) : null;
    if (mediaHref) return { label: linkLabel(m.title ?? m.provider, mediaHref), href: mediaHref };
  }
  return null;
}

function eventImage(e: EventDTO): string | null {
  const m = e.media.find((x) => x.kind === "image") ?? e.media.find((x) => x.poster);
  return safeImageUrl(m ? (m.kind === "image" ? m.url : m.poster) : null);
}

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function itemFromEvent(e: EventDTO): ResumeItem {
  const title = decodeEntities(e.title).slice(0, 200);
  // bodies often open by restating the title — don't print it twice
  const bullets = toBullets(e.body, 4).filter((b) => norm(b) !== norm(title)).slice(0, 3);
  return {
    id: `ev_${e.id}`.slice(0, 40),
    eventId: e.id,
    title,
    subtitle: null,
    location: null,
    dateFrom: eventDate(e),
    dateTo: null,
    bullets,
    link: eventLink(e),
    icon: e.icon ? e.icon.slice(0, 300) : null,
    image: eventImage(e),
  };
}

/** Newest first; undated items sink to the end. Stable for equal dates. */
export function byDateDesc(a: ResumeItem, b: ResumeItem): number {
  return (b.dateFrom ?? "").localeCompare(a.dateFrom ?? "");
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
  const isMail = (h: string) => /^mailto:/i.test(h) || EMAIL_RE.test(h);
  const email = p.socials.map((s) => s.href.trim()).find(isMail);
  return {
    name: p.name.slice(0, 120),
    headline: (p.status || p.bio).slice(0, 200),
    location: p.location.slice(0, 120),
    email: email ? email.replace(/^mailto:/i, "").slice(0, 200) : null,
    avatarUrl: safeImageUrl(p.avatarUrl),
    showAvatar: false,
    links: p.socials
      .filter((s) => !isMail(s.href.trim()))
      .map((s) => ({ label: s.label, href: safeHref(s.href) }))
      .filter((s): s is { label: string; href: string } => !!s.href)
      .slice(0, RESUME_LIMITS.headerLinks)
      .map((s) => ({ label: (s.label || linkLabel(null, s.href)).slice(0, 80), href: s.href, icon: null })),
  };
}

/**
 * Build a complete resume from the log: header from the profile, a summary
 * from bio/about, and one section per event category, newest first. Clamped
 * to RESUME_LIMITS so the result always validates.
 */
// ---------- page budget (#68) ----------
// A rough line model of a single-column sheet at resume type sizes. It only
// has to pick a sensible first draft — the rendered sheet then tightens type
// and spacing to land on the target exactly (or tells the owner it can't).
export const LINES_PER_PAGE = 52;
const CHARS_PER_LINE = 95;
const HEADER_LINES = 7;
const SECTION_HEAD_LINES = 2.5;

const textLines = (t: string) => Math.max(1, Math.ceil(t.length / CHARS_PER_LINE));

export function estimateItemLines(item: ResumeItem): number {
  const bullets = item.bullets.reduce((n, b) => n + textLines(b), 0);
  return 1.6 + bullets + (item.link ? 0.6 : 0);
}

/** Estimated line count of a whole document (visible sections only). */
export function estimateDocumentLines(doc: ResumeDocument): number {
  let lines = HEADER_LINES;
  for (const s of doc.sections) {
    if (s.hidden || (!s.items.length && !s.text?.trim())) continue;
    lines += SECTION_HEAD_LINES + (s.text?.trim() ? textLines(s.text) + 0.5 : 0);
    lines += s.items.reduce((n, i) => n + estimateItemLines(i), 0);
  }
  return lines;
}

/** Owner priority for the page budget: pinned (in pin order), then
 *  featured, then everything else — newest first within each group. */
function budgetRank(profile: ProfileDTO): Map<string, number> {
  const pinned = new Map(profile.pinnedIds.map((id, i) => [id, i]));
  const ordered = [...profile.events].sort((a, b) => {
    const tier = (e: EventDTO) => (pinned.has(e.id) ? 0 : e.featured ? 1 : 2);
    return (
      tier(a) - tier(b) ||
      (pinned.get(a.id) ?? 0) - (pinned.get(b.id) ?? 0) ||
      b.dateOn.localeCompare(a.dateOn)
    );
  });
  return new Map(ordered.map((e, i) => [e.id, i]));
}

export type GenerateOptions = {
  /** Fit the draft to this many pages (omit for "everything", used by merge). */
  pages?: ResumePageCount;
};

/**
 * Build a complete resume from the log: header from the profile, a summary
 * from bio/about, and one section per event category, newest first. With
 * `pages`, only the highest-priority events that fit the budget are placed;
 * the rest stay available via "pull from timeline". Clamped to RESUME_LIMITS
 * so the result always validates.
 */
export function generateResumeDocument(
  profile: ProfileDTO,
  excludedEventIds: string[] = [],
  options: GenerateOptions = {}
): ResumeDocument {
  const liveIds = new Set(profile.events.map((e) => e.id));
  const excluded = new Set(excludedEventIds.filter((id) => liveIds.has(id)));
  const byType = new Map<SectionType, ResumeSection>();
  const section = (type: SectionType) => {
    let s = byType.get(type);
    if (!s) byType.set(type, (s = emptySection(type)));
    return s;
  };

  const summary = [profile.about, profile.bio].map((v) => v?.trim()).find(Boolean);
  if (summary) section("summary").text = summary.slice(0, 2000);

  const candidates = profile.events.filter((e) => !excluded.has(e.id));
  if (options.pages) {
    // spend the budget in owner-priority order; a section's heading is paid
    // for by its first item
    const rank = budgetRank(profile);
    let budget = options.pages * LINES_PER_PAGE - HEADER_LINES;
    if (summary) budget -= SECTION_HEAD_LINES + textLines(summary) + 0.5;
    const opened = new Set<SectionType>();
    const counts = new Map<SectionType, number>();
    for (const e of [...candidates].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)) {
      const type = sectionTypeForTags(e.tags);
      if ((counts.get(type) ?? 0) >= RESUME_LIMITS.itemsPerSection) continue;
      const item = itemFromEvent(e);
      const cost = estimateItemLines(item) + (opened.has(type) ? 0 : SECTION_HEAD_LINES);
      if (cost > budget) continue; // a smaller, lower-priority item may still fit
      budget -= cost;
      opened.add(type);
      counts.set(type, (counts.get(type) ?? 0) + 1);
      section(type).items.push(item);
    }
  } else {
    for (const e of candidates) section(sectionTypeForTags(e.tags)).items.push(itemFromEvent(e));
  }
  for (const s of byType.values()) {
    s.items = s.items.sort(byDateDesc).slice(0, RESUME_LIMITS.itemsPerSection);
  }

  return {
    version: 1,
    header: headerFromProfile(profile),
    sections: SECTION_ORDER.filter((t) => byType.has(t)).map((t) => byType.get(t)!),
    accent: null,
    excludedEventIds: Array.from(excluded).slice(0, RESUME_LIMITS.excludedEventIds),
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
      // keep reverse-chron: new items slot in ahead of the first older one.
      // Additions arrive newest first, so a nearly full section takes the most
      // recent events. Sync never removes what's already on the resume (it may
      // carry the owner's edits); what doesn't fit is reported via
      // resumeOverflow() so the owner can make room and pull events in.
      for (const item of additions) {
        if (target.items.length >= RESUME_LIMITS.itemsPerSection) break;
        const at = target.items.findIndex((i) => (i.dateFrom ?? "") < (item.dateFrom ?? ""));
        target.items.splice(at < 0 ? target.items.length : at, 0, item);
      }
      if (fs.type === "summary" && !target.text && fs.text) target.text = fs.text;
    } else if (additions.length && sections.length < RESUME_LIMITS.sections) {
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

/** Log events that belong on the resume (not deleted, not excluded by the
 *  owner) but aren't on it because their section is at the item cap. */
export function resumeOverflow(doc: ResumeDocument, profile: ProfileDTO): number {
  const excluded = new Set(doc.excludedEventIds);
  const present = new Set(doc.sections.flatMap((s) => s.items.map((i) => i.eventId)));
  const full = new Set(
    doc.sections.filter((s) => s.items.length >= RESUME_LIMITS.itemsPerSection).map((s) => s.type)
  );
  return profile.events.filter(
    (e) => !excluded.has(e.id) && !present.has(e.id) && full.has(sectionTypeForTags(e.tags))
  ).length;
}

/** Log events that aren't on the resume and weren't removed by the owner —
 *  left out by the page budget (or a full section); pullable from the timeline. */
export function resumeNotIncluded(doc: ResumeDocument, profile: ProfileDTO): number {
  const excluded = new Set(doc.excludedEventIds);
  const present = new Set(doc.sections.flatMap((s) => s.items.map((i) => i.eventId)));
  return profile.events.filter((e) => !excluded.has(e.id) && !present.has(e.id)).length;
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
  // newest exclusions win if the cap is ever hit
  return { ...next, excludedEventIds: Array.from(excluded).slice(-RESUME_LIMITS.excludedEventIds) };
}

/** Pick a template from the shape of the log (used when AI is unavailable). */
export function suggestTemplate(doc: ResumeDocument): ResumeTemplate {
  const count = (t: SectionType) => doc.sections.find((s) => s.type === t)?.items.length ?? 0;
  const items = doc.sections.flatMap((s) => s.items);
  const imageItems = items.filter((i) => i.image).length;
  if (count("talks") + count("writing") > count("experience") + count("projects")) return "academic";
  // visual-first logs only: most items have images and work history doesn't dominate
  if (imageItems >= 4 && imageItems >= items.length * 0.6 && count("experience") * 2 < items.length) return "creative";
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
