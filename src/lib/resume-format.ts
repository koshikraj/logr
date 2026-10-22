// Pure display helpers for the resume templates and editor (#66). Safe to
// import from client components — no DB, no server-only modules.

import type { ResumeDocument, ResumeItem, ResumeSection } from "@/lib/resume";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024" → "2024", "2024-03" → "Mar 2024", "2024-03-15" → "Mar 15, 2024", "present" → "Present". */
export function formatResumeDate(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "present") return "Present";
  const [y, m, d] = value.split("-");
  const mon = m ? MONTHS[Number(m) - 1] : undefined;
  if (!mon) return y;
  return d ? `${mon} ${Number(d)}, ${y}` : `${mon} ${y}`;
}

/** "Mar 2024 – Present", or just the start when there is no end. */
export function formatResumeRange(item: Pick<ResumeItem, "dateFrom" | "dateTo">): string {
  const from = formatResumeDate(item.dateFrom);
  const to = formatResumeDate(item.dateTo);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** Year only — for compact / numbered layouts. */
export function formatResumeYear(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "present") return "now";
  return value.slice(0, 4);
}

export const LUCIDE_PREFIX = "lucide:";

export type IconKind = "none" | "emoji" | "image" | "lucide";

export function iconKind(icon: string | null | undefined): IconKind {
  if (!icon) return "none";
  if (icon.startsWith(LUCIDE_PREFIX)) return "lucide";
  if (/^(https?:\/\/|\/)/.test(icon)) return "image";
  return "emoji";
}

/** Visible (non-hidden) sections, in order. */
export function visibleSections(doc: ResumeDocument): ResumeSection[] {
  return doc.sections.filter((s) => !s.hidden && (s.items.length > 0 || (s.text ?? "").trim().length > 0));
}

/** A readable hostname for a link (github.com/koshik → "github.com/koshik"). */
export function linkDisplay(href: string): string {
  try {
    if (/^mailto:/i.test(href)) return href.replace(/^mailto:/i, "");
    const u = new URL(href);
    const path = u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path === "" ? "" : path}`;
  } catch {
    return href;
  }
}

/**
 * Fit-to-target ladder (#68). Each step tightens the sheet a little more:
 * spacing first (section/item gaps), then margins (`--r-pad`), then type
 * (a zoom on the body; 1 = 10.5pt base). The last step is the readability
 * floor: 0.9 keeps body text at ≈9.5pt, above the 9pt floor résumé tools
 * use, with margins never below 10mm. Mirrored by `.resume[data-fit="n"]`
 * rules in resume.css.
 */
export const FIT_STEPS = [
  { density: "normal", pad: "14mm", type: 1 },
  { density: "tight", pad: "14mm", type: 1 },
  { density: "tight", pad: "12mm", type: 1 },
  { density: "tight", pad: "12mm", type: 0.96 },
  { density: "tight", pad: "11mm", type: 0.93 },
  { density: "tight", pad: "10mm", type: 0.9 },
] as const;
export const FIT_FLOOR_TYPE = FIT_STEPS[FIT_STEPS.length - 1].type;

export const PAGE_DIMENSIONS = {
  // px at 96dpi, exact: print paginates at 297mm = 1122.52px, so 1123 would
  // let a sheet that is 1px too tall read as "fits" and print a blank page
  A4: { width: "210mm", height: "297mm", px: { width: 793.7, height: 1122.52 } },
  Letter: { width: "8.5in", height: "11in", px: { width: 816, height: 1056 } },
} as const;

let counter = 0;
/** Short unique ids for new sections/items (max 40 chars per the schema). */
export function newResumeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`.slice(0, 40);
}
