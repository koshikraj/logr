import { prisma } from "@/lib/db";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Derive the display string + year from an ISO date (the single source).
 *  fullDate shows the day ("Apr 15, 2026"); otherwise month + year. */
function deriveDate(dateOn: string, fullDate: boolean): { date: string; year: number } {
  const [y, m, d] = dateOn.split("-").map(Number);
  const mon = MONTHS_SHORT[(m || 1) - 1];
  return { date: fullDate ? `${mon} ${d}, ${y}` : `${mon} ${y}`, year: y };
}

export type Social = { label: string; href: string };

export type MediaItem = {
  kind: "image" | "video" | "link" | "tweet";
  url: string; // image URL, video embed URL, or external link
  poster: string | null; // thumbnail (video frame / og:image)
  provider: string | null; // youtube | vimeo | loom | site name
  title: string | null; // card title for links
};

export type EventDTO = {
  id: string;
  dateOn: string; // canonical ISO date (the single source)
  date: string; // derived display string, e.g. "Nov 2025"
  year: number; // derived
  title: string;
  tags: string[];
  featured: boolean; // shown in the page's "highlights" view
  fullDate: boolean; // editor toggle: show the exact day
  body: string;
  icon: string | null; // optional glyph/emoji for the timeline dot
  link: { label: string; href: string } | null;
  media: MediaItem[]; // images + videos, in order (empty placeholder slots dropped)
};

export type ProfileDTO = {
  id: string;
  username: string;
  name: string;
  handle: string;
  bio: string;
  status: string;
  location: string;
  about: string | null;
  avatarUrl: string | null;
  socials: Social[];
  theme: Theme;
  activeOrbit: string | null;
  dsaMetrics: string | null;
  sysArchitecture: string | null;
  events: EventDTO[];
};

function parseJSON<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getProfile(username: string): Promise<ProfileDTO | null> {
  const row = await prisma.profile.findUnique({
    where: { username },
    include: {
      events: {
        orderBy: { position: "asc" },
        include: { media: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    handle: row.handle,
    bio: row.bio,
    status: row.status,
    location: row.location,
    about: row.about,
    avatarUrl: row.avatarUrl,
    socials: parseJSON<Social[]>(row.socials, []),
    theme: { ...DEFAULT_THEME, ...parseJSON<Partial<Theme>>(row.theme, {}) },
    activeOrbit: row.activeOrbit,
    dsaMetrics: row.dsaMetrics,
    sysArchitecture: row.sysArchitecture,
    events: row.events.map((e) => ({
      id: e.id,
      dateOn: e.dateOn,
      ...deriveDate(e.dateOn, e.fullDate),
      title: e.title,
      tags: e.tags,
      featured: e.featured,
      fullDate: e.fullDate,
      body: e.body,
      icon: e.icon,
      link: e.linkHref ? { label: e.linkLabel ?? e.linkHref, href: e.linkHref } : null,
      media: e.media
        .filter((m) => !!m.url)
        .map((m) => ({
          kind:
            m.kind === "video"
              ? ("video" as const)
              : m.kind === "link"
                ? ("link" as const)
                : m.kind === "tweet"
                  ? ("tweet" as const)
                  : ("image" as const),
          url: m.url as string,
          poster: m.poster,
          provider: m.provider,
          title: m.title,
        })),
    })),
  };
}

/** The single-user homepage profile for Phase 1. */
export const PRIMARY_USERNAME = "koshik";
