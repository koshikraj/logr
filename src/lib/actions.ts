"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";
import { unfurl } from "@/lib/unfurl";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isChatEnabled, CHAT_MODEL } from "@/lib/chat";
import { buildNarratePrompt, parseNarrated } from "@/lib/narrate";
import { parseVideoUrl, parseTweetUrl } from "@/lib/video";
import { requireProfileId, requireSignedIn, getUserId } from "@/lib/session";
import { signIn, signOut } from "@/auth";

async function revalidateForProfile(profileId: string) {
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true } });
  revalidatePath("/");
  revalidatePath("/dashboard");
  if (p) revalidatePath(`/${p.username}`);
}

// ---------- AUTH ----------
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Landing "claim a handle" → Google OAuth → /welcome (handle carried as a hint). */
export async function startSignupAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "")
    .trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  const redirectTo = handle ? `/welcome?handle=${encodeURIComponent(handle)}` : "/welcome";
  await signIn("google", { redirectTo });
}

/** Plain "continue with Google" (login page). */
export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/welcome" });
}


// ---------- PROFILE ----------
function parseSocials(raw: string) {
  // One per line: "Label url"
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s+(\S+)$/);
      if (m) {
        const label = m[1].trim();
        let href = m[2].trim();
        if (!/^(?:https?|mailto|tel):/i.test(href)) {
          if (/@\S+\.\S+/.test(href)) {
            href = `mailto:${href}`;
          } else {
            href = `https://${href}`;
          }
        }
        return { label, href };
      }
      
      let href = line;
      if (!/^(?:https?|mailto|tel):/i.test(href)) {
        if (/@\S+\.\S+/.test(href)) {
          href = `mailto:${href}`;
        } else {
          href = `https://${href}`;
        }
      }
      return { label: line, href };
    });
}

// ---------- ONBOARDING ----------
const RESERVED = new Set([
  "admin", "login", "logout", "welcome", "api", "dashboard", "settings", "new",
  "about", "help", "terms", "privacy", "_next", "static", "llm", "robots", "sitemap",
]);

function validateHandle(u: string): { ok: true } | { ok: false; error: string } {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(u)) return { ok: false, error: "3–30 chars: letters, numbers, hyphens" };
  if (RESERVED.has(u)) return { ok: false, error: "that handle is reserved" };
  return { ok: true };
}

export async function checkHandleAction(handle: string): Promise<{ available: boolean; error?: string }> {
  await requireSignedIn();
  const u = handle.trim().toLowerCase();
  const v = validateHandle(u);
  if (!v.ok) return { available: false, error: v.error };
  const taken = await prisma.profile.findUnique({ where: { username: u }, select: { id: true } });
  return taken ? { available: false, error: "taken" } : { available: true };
}

export async function createProfileAction(
  input: { handle: string; name: string; bio: string; avatarUrl: string | null }
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const existing = await prisma.profile.findUnique({ where: { userId }, select: { username: true } });
  if (existing) return { ok: true, username: existing.username }; // already onboarded
  const username = input.handle.trim().toLowerCase();
  const v = validateHandle(username);
  if (!v.ok) return { ok: false, error: v.error };
  if (await prisma.profile.findUnique({ where: { username }, select: { id: true } })) {
    return { ok: false, error: "That handle is taken" };
  }
  await prisma.profile.create({
    data: {
      userId,
      username,
      name: input.name.trim() || username,
      handle: `@${username}`,
      bio: input.bio.trim(),
      status: "Establishing link...",
      location: "Earth",
      about: null,
      avatarUrl: input.avatarUrl || null,
      socials: "[]",
      theme: JSON.stringify(DEFAULT_THEME),
      
      // NEW: Inject default command center data for new users!
      activeOrbit: "Exploring the tech frontier\nBuilding scalable solutions",
      dsaMetrics: "TypeScript: Active\nReact: Active",
      sysArchitecture: "TypeScript, React, Node.js",
    },
  });
  return { ok: true, username };
}

export async function updateProfileAction(formData: FormData) {
  const profileId = await requireProfileId();
  const socials = parseSocials(String(formData.get("socials") ?? ""));
  await prisma.profile.update({
    where: { id: profileId },
    data: {
      name: String(formData.get("name") ?? ""),
      handle: String(formData.get("handle") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      status: String(formData.get("status") ?? ""),
      location: String(formData.get("location") ?? ""),
      about: String(formData.get("about") ?? "") || null,
      avatarUrl: String(formData.get("avatarUrl") ?? "") || null,
      socials: JSON.stringify(socials),
      activeOrbit: String(formData.get("activeOrbit") ?? "") || null,
      dsaMetrics: String(formData.get("dsaMetrics") ?? "") || null,
      sysArchitecture: String(formData.get("sysArchitecture") ?? "") || null,
    },
  });
  await revalidateForProfile(profileId);
}

export async function updateThemeAction(theme: Partial<Theme>) {
  const profileId = await requireProfileId();
  const row = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { theme: true },
  });
  let current: Theme = DEFAULT_THEME;
  try {
    current = { ...DEFAULT_THEME, ...JSON.parse(row?.theme ?? "{}") };
  } catch {
    /* keep default */
  }
  await prisma.profile.update({
    where: { id: profileId },
    data: { theme: JSON.stringify({ ...current, ...theme }) },
  });
  await revalidateForProfile(profileId);
}

// ---------- EVENTS ----------
export type MediaInput = {
  kind: "image" | "video" | "link" | "tweet";
  url: string;
  poster: string | null;
  provider: string | null;
  title: string | null;
};

export type EventInput = {
  id?: string;
  dateOn: string;
  fullDate: boolean;
  title: string;
  tags: string[];
  featured: boolean;
  body: string;
  icon: string | null;
  linkLabel: string | null;
  linkHref: string | null;
  position: number;
  media: MediaInput[]; // images + videos (0–8)
};

export async function saveEventAction(input: EventInput) {
  const profileId = await requireProfileId();

  const data = {
    dateOn: input.dateOn,
    fullDate: input.fullDate,
    title: input.title,
    tags: input.tags,
    featured: input.featured,
    body: input.body,
    icon: input.icon,
    linkLabel: input.linkLabel,
    linkHref: input.linkHref,
    position: input.position,
  };

  const media = {
    create: input.media.slice(0, 8).map((m, position) => ({
      kind: m.kind,
      url: m.url || null,
      poster: m.poster,
      provider: m.provider,
      title: m.title,
      position,
    })),
  };

  if (input.id) {
    // ownership check: the event must belong to the current profile
    const owned = await prisma.event.findFirst({ where: { id: input.id, profileId }, select: { id: true } });
    if (!owned) throw new Error("Not found");
    await prisma.media.deleteMany({ where: { eventId: input.id } });
    await prisma.event.update({ where: { id: input.id }, data: { ...data, media } });
  } else {
    await prisma.event.create({ data: { ...data, profileId, media } });
  }
  await revalidateForProfile(profileId);
}

export async function deleteEventAction(id: string) {
  const profileId = await requireProfileId();
  await prisma.event.deleteMany({ where: { id, profileId } });
  await revalidateForProfile(profileId);
}

export type ReviewEvent = {
  dateOn: string;
  fullDate: boolean;
  title: string;
  tags: string[];
  featured: boolean;
  body: string;
  media: MediaInput[];
};

/** Turn URLs from the narrative into media (tweet / video embed / link card). */
async function resolveMedia(links: string[]): Promise<MediaInput[]> {
  const out: MediaInput[] = [];
  for (const url of links.slice(0, 4)) {
    if (parseTweetUrl(url)) {
      out.push({ kind: "tweet", url, poster: null, provider: "x", title: null });
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

async function narrateText(text: string): Promise<ReviewEvent[]> {
  if (!isChatEnabled()) throw new Error("Chat is not configured.");
  if (!text.trim()) return [];
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
  const { text: out } = await generateText({
    model: openrouter.chat(CHAT_MODEL),
    system:
      "You output ONLY a raw JSON object — no prose, no markdown fences, no commentary. " +
      'Shape: {"events":[{"dateOn":"YYYY-MM-DD","fullDate":boolean,"title":string,"tags":string[],"featured":boolean,"body":string,"links":string[]}]}. ' +
      "tags must be a subset of: work, milestone, talk, side_quest, writing. links are full https URLs mentioned for the event.",
    prompt: buildNarratePrompt(text.slice(0, 8000)),
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
      media: await resolveMedia(e.links),
    }))
  );
}

/** Extract structured events (with link/video/tweet media) from a narrative. */
export async function narrateEventsAction(text: string): Promise<ReviewEvent[]> {
  await requireSignedIn();
  return narrateText(text);
}

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

/** Extract events from an uploaded resume (PDF, DOCX, or plain text). */
export async function importFileAction(formData: FormData): Promise<ReviewEvent[]> {
  await requireSignedIn();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided.");
  if (file.size > FILE_SIZE_LIMIT) throw new Error("File is too large (max 5 MB).");

  const { extractPdfText, extractDocxText } = await import("@/lib/import");
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let text: string;
  if (name.endsWith(".pdf")) {
    text = await extractPdfText(buffer);
  } else if (name.endsWith(".docx")) {
    text = await extractDocxText(buffer);
  } else {
    text = buffer.toString("utf-8");
  }

  return narrateText(text);
}

/** Extract events from a public portfolio or LinkedIn URL. */
export async function importUrlAction(url: string): Promise<ReviewEvent[]> {
  await requireSignedIn();
  if (!url.trim()) return [];
  const { fetchUrlText } = await import("@/lib/import");
  const text = await fetchUrlText(url.trim());
  return narrateText(text);
}

/** Bulk-insert events extracted from a narrative (newest get the top slots). */
export async function insertEventsAction(events: ReviewEvent[]) {
  const profileId = await requireProfileId();
  const clean = events
    .filter((e) => e.title?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(e.dateOn))
    .slice(0, 50);
  if (!clean.length) return;
  const agg = await prisma.event.aggregate({ where: { profileId }, _min: { position: true } });
  let pos = (agg._min.position ?? 0) - clean.length;
  await prisma.$transaction(
    clean.map((e) =>
      prisma.event.create({
        data: {
          profileId,
          dateOn: e.dateOn,
          fullDate: !!e.fullDate,
          title: e.title.trim(),
          tags: e.tags.filter((t) => TAG_OPTIONS_SET.has(t)),
          featured: !!e.featured,
          body: e.body ?? "",
          icon: null,
          linkLabel: null,
          linkHref: null,
          position: pos++,
          media: {
            create: (e.media ?? []).slice(0, 8).map((m, i) => ({
              kind: m.kind,
              url: m.url || null,
              poster: m.poster,
              provider: m.provider,
              title: m.title,
              position: i,
            })),
          },
        },
      })
    )
  );
  await revalidateForProfile(profileId);
}

const TAG_OPTIONS_SET = new Set(["work", "milestone", "talk", "side_quest", "writing"]);

/** Fetch Open Graph data for a pasted link, to build a link/article card. */
export async function unfurlLinkAction(url: string): Promise<MediaInput> {
  await requireSignedIn();
  const { title, poster, provider } = await unfurl(url);
  return { kind: "link", url, poster, provider, title };
}

/** Persist a full drag-reordered list: position = index in `orderedIds` (scoped to the profile). */
export async function reorderEventsAction(orderedIds: string[]) {
  const profileId = await requireProfileId();
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.event.updateMany({ where: { id, profileId }, data: { position: i } }))
  );
  await revalidateForProfile(profileId);
}
