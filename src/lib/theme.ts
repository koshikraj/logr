// logr theme system (rebrand) — editorial serif identity.
// One palette token set (paper/ink/accent/muted/faint) drives every layout;
// layouts are pure [data-layout] reshapes of the .entry timeline.

export type Palette = {
  name: string;
  note: string;
  paper: string;
  ink: string;
  accent: string;
  muted: string;
  faint: string;
  dark: boolean;
};

export const PALETTES: Record<string, Palette> = {
  paper: { name: "paper", note: "brand default", paper: "#FAF8F3", ink: "#1A1A1A", accent: "#D85A30", muted: "#6B6862", faint: "#95918A", dark: false },
  sepia: { name: "sepia", note: "warmer paper", paper: "#F4EBD9", ink: "#2A1F12", accent: "#C24A20", muted: "#7A6A52", faint: "#A89A82", dark: false },
  arctic: { name: "arctic", note: "cool white", paper: "#FAFAFA", ink: "#111111", accent: "#2D4CF5", muted: "#6F6F6F", faint: "#A5A5A5", dark: false },
  mono: { name: "mono", note: "no colour", paper: "#FAFAF9", ink: "#0D0D0C", accent: "#0D0D0C", muted: "#7A7A76", faint: "#A8A8A4", dark: false },
  citrus: { name: "citrus", note: "warm bright", paper: "#FEF9EC", ink: "#1C1A12", accent: "#D8631F", muted: "#7A755E", faint: "#A8A48A", dark: false },
  forest: { name: "forest", note: "sage", paper: "#EEF1EA", ink: "#15201A", accent: "#3E6B4A", muted: "#5A6957", faint: "#8B9787", dark: false },
  ocean: { name: "ocean", note: "deep blue", paper: "#EEF4F7", ink: "#0E1D2A", accent: "#1A73C4", muted: "#5B7286", faint: "#8FA2B3", dark: false },
  lavender: { name: "lavender", note: "iris", paper: "#F5F2FB", ink: "#1F1530", accent: "#7A4EE0", muted: "#7A6E95", faint: "#A89DC0", dark: false },
  ink: { name: "ink", note: "dark", paper: "#1A1814", ink: "#F2EFE8", accent: "#D85A30", muted: "#8E8A82", faint: "#5F5C56", dark: true },
};

export type LayoutMeta = { name: string; note: string };

// timeline is the new default; the rest reshape the same .entry markup.
export const LAYOUTS: Record<string, LayoutMeta> = {
  timeline: { name: "timeline", note: "rail + recency dots (default)" },
  journal: { name: "journal", note: "date in the margin" },
  magazine: { name: "magazine", note: "editorial, image-led" },
  terminal: { name: "terminal", note: "mono, ascii rail" },
  feed: { name: "feed", note: "compact social feed" },
  card: { name: "card", note: "elevated cards" },
  centered: { name: "centered", note: "alternating sides" },
  polaroid: { name: "polaroid", note: "scrapbook photos" },
};

export type Layout = keyof typeof LAYOUTS;

export const FONTS = {
  // Geist for text, Geist Mono for monospace. The `serif` key is kept for
  // backward-compat with all `--serif` consumers; it now resolves to Geist.
  serif: '"Geist", system-ui, -apple-system, sans-serif',
  sans: '"Geist", system-ui, -apple-system, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
};

export type Theme = {
  palette: string;
  layout: string;
  accentOverride: string | null; // personal --user-accent override
};

export const DEFAULT_THEME: Theme = {
  palette: "paper",
  layout: "timeline",
  accentOverride: null,
};

// Accent swatches offered for the personal accent (palette accents).
export const ACCENT_SWATCHES = [
  "#D85A30", "#C24A20", "#2D4CF5", "#0D0D0C", "#D8631F", "#3E6B4A", "#1A73C4", "#7A4EE0",
];

export type TagKey = "all" | "work" | "milestone" | "talk" | "side_quest" | "writing";

export const TAG_META: Record<string, { label: string }> = {
  work: { label: "work" },
  milestone: { label: "milestone" },
  talk: { label: "talk" },
  side_quest: { label: "side quest" },
  writing: { label: "writing" },
};

function hexAlpha(hex: string, alpha: number): string {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolvePalette(theme: Theme): Palette {
  return PALETTES[theme.palette] ?? PALETTES.paper;
}

/** CSS custom properties the stylesheet consumes, for the active palette. */
export function themeCssVars(theme: Theme): Record<string, string> {
  const p = resolvePalette(theme);
  const userAccent = theme.accentOverride || p.accent;
  return {
    "--paper": p.paper,
    "--ink": p.ink,
    "--accent": p.accent,
    "--user-accent": userAccent,
    "--muted": p.muted,
    "--faint": p.faint,
    "--rule": hexAlpha(p.ink, 0.12),
    "--rule-strong": hexAlpha(p.ink, 0.28),
    "--serif": FONTS.serif,
    "--sans": FONTS.sans,
    "--mono": FONTS.mono,
  };
}

/** Map a highlight's position in the (reverse-chronological) list to a
 *  recency bucket, driving dot size/opacity in the timeline layout. */
export function recencyClass(index: number, total: number): string {
  if (total <= 1) return "now";
  if (index === 0) return "now";
  const frac = index / (total - 1);
  if (frac <= 0.2) return "recent";
  if (frac <= 0.5) return "mid";
  if (frac <= 0.8) return "past";
  return "far";
}
