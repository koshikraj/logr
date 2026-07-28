"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";
import { unfurl } from "@/lib/unfurl";
import { extractEvents, EXTRACT_HINTS } from "@/lib/extract";
import { insertEventsForProfile, sanitizeTags } from "@/lib/events";
import type { MediaInput, ReviewEvent, SourceChip, SourceKind, SourceStatus } from "@/lib/import-types";
import { parseSocials } from "@/lib/socials";
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

/** "Continue with X" (login page) — existing accounts sign in; unknown X
 *  identities get a fresh User, and /welcome offers any claimable profile. */
export async function xSignInAction() {
  await signIn("twitter", { redirectTo: "/welcome" });
}

/** Claim the seeded profile matching the user's verified X handle (welcome screen). */
export async function claimProfileAction() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const { claimProfile } = await import("@/lib/claim");
  const res = await claimProfile(userId);
  if (!res.ok) redirect("/welcome?claim=failed");
  revalidatePath("/");
  revalidatePath(`/${res.username}`);
  // land on their own page, running the same first-run tour new users get
  redirect(`/${res.username}?tour=1`);
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
      bio: input.bio.trim(),
      status: "",
      location: "",
      about: null,
      avatarUrl: input.avatarUrl || null,
      socials: "[]",
      // new users start on the feed layout (DEFAULT_THEME stays "timeline"
      // as the fallback for legacy/seeded profiles)
      theme: JSON.stringify({ ...DEFAULT_THEME, layout: "feed" }),
    },
  });
  return { ok: true, username };
}

export async function updateProfileAction(
  formData: FormData
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const profileId = await requireProfileId();
  const current = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true } });
  if (!current) return { ok: false, error: "Profile not found" };

  // the "handle" field edits the username (= the public URL slug)
  const username = String(formData.get("handle") ?? "").trim().toLowerCase().replace(/^@/, "");
  if (username !== current.username) {
    const v = validateHandle(username);
    if (!v.ok) return { ok: false, error: v.error };
    if (await prisma.profile.findUnique({ where: { username }, select: { id: true } })) {
      return { ok: false, error: "That handle is taken" };
    }
  }

  const socials = parseSocials(String(formData.get("socials") ?? ""));
  await prisma.profile.update({
    where: { id: profileId },
    data: {
      username,
      name: String(formData.get("name") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      status: String(formData.get("status") ?? ""),
      location: String(formData.get("location") ?? ""),
      about: String(formData.get("about") ?? "") || null,
      avatarUrl: String(formData.get("avatarUrl") ?? "") || null,
      socials: JSON.stringify(socials),
    },
  });
  if (username !== current.username) revalidatePath(`/${current.username}`); // old URL
  await revalidateForProfile(profileId);
  return { ok: true, username };
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

/** Persist the owner's pinned rail: up to 7 of their own event ids (display
 *  order is derived newest-first, so only membership is stored). */
export async function updatePinnedAction(ids: string[]) {
  const profileId = await requireProfileId();
  let pinned = Array.from(
    new Set((Array.isArray(ids) ? ids : []).filter((v): v is string => typeof v === "string"))
  ).slice(0, 7);
  if (pinned.length) {
    // only ids that belong to this profile's events survive
    const owned = await prisma.event.findMany({
      where: { profileId, id: { in: pinned } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((e) => e.id));
    pinned = pinned.filter((id) => ownedIds.has(id));
  }
  await prisma.profile.update({
    where: { id: profileId },
    data: { pinned: JSON.stringify(pinned) },
  });
  await revalidateForProfile(profileId);
}

// ---------- EVENTS ----------
export type { MediaInput, ReviewEvent } from "@/lib/import-types";

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
    tags: sanitizeTags(input.tags),
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

/** Extract structured events (with link/video/tweet media) from a narrative. */
export async function narrateEventsAction(text: string): Promise<ReviewEvent[]> {
  await requireSignedIn();
  return extractEvents(text);
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

  return extractEvents(text, EXTRACT_HINTS.resume);
}

/** Extract events from a public portfolio or LinkedIn URL. */
export async function importUrlAction(url: string): Promise<ReviewEvent[]> {
  await requireSignedIn();
  if (!url.trim()) return [];
  const { fetchUrlText } = await import("@/lib/import");
  const text = await fetchUrlText(url.trim());
  return extractEvents(text, EXTRACT_HINTS.site);
}

/** Bulk-insert events extracted from a narrative (newest get the top slots). */
export async function insertEventsAction(events: ReviewEvent[]) {
  const profileId = await requireProfileId();
  await insertEventsForProfile(profileId, events);
  await revalidateForProfile(profileId);
}



// ---------- IMPORT JOBS (magical onboarding) ----------

export type ImportJobView = {
  jobId: string;
  status: "running" | "done" | "error";
  sources: SourceChip[];
  events: ReviewEvent[];
};

function parseEventsJson(raw: string | null): ReviewEvent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as ReviewEvent[]) : [];
  } catch {
    return [];
  }
}

async function jobViewFor(userId: string): Promise<ImportJobView | null> {
  const job = await prisma.importJob.findFirst({
    where: { userId, consumedAt: null, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    include: { sources: true },
  });
  if (!job) return null;
  const events = job.mergedEvents
    ? parseEventsJson(job.mergedEvents)
    : job.sources.flatMap((s) => parseEventsJson(s.events));
  return {
    jobId: job.id,
    status: job.status,
    sources: job.sources.map((s) => ({
      id: s.id,
      kind: s.kind as SourceKind,
      label: s.label,
      status: s.status as SourceStatus,
      eventCount: s.eventCount,
      error: s.error ?? undefined,
    })),
    events,
  };
}

/** The user's latest live import job (dashboard wait state). */
export async function getImportJobAction(): Promise<ImportJobView | null> {
  const userId = await getUserId();
  if (!userId) return null;
  return jobViewFor(userId);
}

/** Public: live build progress for a handle whose page is still being
 *  assembled — powers the /[username] live-building view. The in-flight
 *  events are moments away from being public anyway. */
export async function profileBuildStatusAction(username: string): Promise<ImportJobView | null> {
  const profile = await prisma.profile.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { userId: true },
  });
  if (!profile?.userId) return null;
  return jobViewFor(profile.userId);
}

/** Remove auto-published imported events the user tapped out during the
 *  building screen (matched by date+title, imported provenance only). */
export async function removeImportedEventsAction(keys: { dateOn: string; title: string }[]) {
  const profileId = await requireProfileId();
  const clean = keys
    .filter((k) => typeof k?.dateOn === "string" && typeof k?.title === "string")
    .slice(0, 40);
  if (!clean.length) return;
  await prisma.event.deleteMany({
    where: {
      profileId,
      provenance: "userImported",
      OR: clean.map((k) => ({ dateOn: k.dateOn, title: k.title })),
    },
  });
  await revalidateForProfile(profileId);
}

/** Mark a job's events as inserted so it stops resurfacing. */
export async function consumeImportJobAction(jobId: string) {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.importJob.updateMany({
    where: { id: jobId, userId },
    data: { consumedAt: new Date() },
  });
}

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
