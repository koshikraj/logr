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
import { requireProfileId, requireSignedIn, getUserId, currentProfileId } from "@/lib/session";
import { signIn, signOut } from "@/auth";
import { getProfile, type ProfileDTO } from "@/lib/profile";
import { rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";
import {
  DEFAULT_RESUME_PAGES,
  generateResumeDocument,
  isResumePageCount,
  isResumePageSize,
  isResumeTemplate,
  mergeResumeDocument,
  reconcileExclusions,
  resumeNotIncluded,
  resumeOverflow,
  suggestTemplate,
  validateResumeDocument,
  type ResumePageCount,
  type ResumePageSize,
  type ResumePolish,
  type ResumeTemplate,
} from "@/lib/resume";
import { getResumeForProfile, type ResumeView } from "@/lib/resume-data";
import {
  validateAuthorizeRequest,
  issueAuthorizationCode,
  listGrantsForProfile,
  revokeGrantForProfile,
  type GrantView,
} from "@/lib/oauth";

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

/** Post-login destination: internal paths only (e.g. back to /oauth/authorize). */
function safeNext(formData?: FormData): string | null {
  const next = String(formData?.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** Plain "continue with Google" (login page). */
export async function googleSignInAction(formData?: FormData) {
  await signIn("google", { redirectTo: safeNext(formData) ?? "/welcome" });
}

/** "Continue with X" (login page) — existing accounts sign in; unknown X
 *  identities get a fresh User, and /welcome offers any claimable profile. */
export async function xSignInAction(formData?: FormData) {
  await signIn("twitter", { redirectTo: safeNext(formData) ?? "/welcome" });
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
  "mcp", "oauth", "explore",
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

// ---------- MCP OAUTH (issue #58) ----------

/** Rebuild the original authorize query params from the consent form. */
function authorizeParamsFromForm(formData: FormData): { [k: string]: string | undefined } {
  const params: { [k: string]: string | undefined } = {};
  for (const key of [
    "client_id",
    "redirect_uri",
    "response_type",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
    "resource",
  ]) {
    const v = formData.get(key);
    if (typeof v === "string" && v !== "") params[key] = v;
  }
  return params;
}

/** Owner approved the consent screen: re-validate everything server-side,
 *  mint the code bound to their own profile, and send the agent back. */
export async function approveOAuthAction(formData: FormData) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const profileId = await requireProfileId();

  const result = await validateAuthorizeRequest(authorizeParamsFromForm(formData));
  if (!result.ok) {
    if (result.kind === "redirect") {
      const url = new URL(result.redirectUri);
      url.searchParams.set("error", result.error);
      if (result.state) url.searchParams.set("state", result.state);
      redirect(url.toString());
    }
    redirect("/"); // fatal (tampered client/redirect) — never redirect to it
  }

  const code = await issueAuthorizationCode(result.request, { userId: userId!, profileId });
  const url = new URL(result.request.redirectUri);
  url.searchParams.set("code", code);
  if (result.request.state) url.searchParams.set("state", result.request.state);
  redirect(url.toString());
}

/** Owner denied the consent screen. */
export async function denyOAuthAction(formData: FormData) {
  const result = await validateAuthorizeRequest(authorizeParamsFromForm(formData));
  if (result.ok) {
    const url = new URL(result.request.redirectUri);
    url.searchParams.set("error", "access_denied");
    if (result.request.state) url.searchParams.set("state", result.request.state);
    redirect(url.toString());
  }
  redirect("/");
}

/** Dashboard "connected agents" panel. */
export async function listConnectedAgentsAction(): Promise<GrantView[]> {
  const profileId = await requireProfileId();
  return listGrantsForProfile(profileId);
}

export async function revokeAgentAction(tokenId: string): Promise<GrantView[]> {
  const profileId = await requireProfileId();
  await revokeGrantForProfile(profileId, tokenId);
  return listGrantsForProfile(profileId);
}

// ---------- RESUME BUILDER (issue #66) ----------
// These return a result instead of throwing: Next masks thrown server-action
// messages in production, and the editor needs to show what went wrong.

export type ResumeResult<T = ResumeView> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** The signed-in owner's profile id + handle (cheap — no events). */
async function ownerRef(): Promise<{ id: string; username: string } | null> {
  const profileId = await currentProfileId();
  if (!profileId) return null;
  return prisma.profile.findUnique({ where: { id: profileId }, select: { id: true, username: true } });
}

/** The owner's full profile DTO — only where the log itself is needed. */
async function ownerProfile(): Promise<ProfileDTO | null> {
  const ref = await ownerRef();
  return ref ? getProfile(ref.username) : null;
}

/** Validate and write; the stored document is always one reads accept. */
async function writeResume(
  profileId: string,
  document: unknown,
  extra: { template?: ResumeTemplate; pageSize?: ResumePageSize; pages?: ResumePageCount; generatedAt?: Date } = {}
): Promise<ResumeResult> {
  const valid = validateResumeDocument(document);
  if (!valid.ok) return fail(valid.error);
  const data = { document: JSON.stringify(valid.document), ...extra };
  await prisma.resume.upsert({
    where: { profileId },
    create: { profileId, template: extra.template ?? suggestTemplate(valid.document), ...data },
    update: data,
  });
  const view = await getResumeForProfile(profileId);
  return view ? { ok: true, data: view } : fail("Saved, but the resume couldn't be read back.");
}

/** The owner's resume, or null before the first generate. */
export async function getResumeAction(): Promise<ResumeView | null> {
  const profileId = await requireProfileId();
  return getResumeForProfile(profileId);
}

/**
 * Build the resume from the log. With no resume yet this creates one (and
 * picks a template from the log's shape). Otherwise `merge` adds new events
 * and drops deleted ones while keeping every edit; `replace` starts over
 * (keeping template, page size, and publish state).
 */
export async function generateResumeAction(
  mode: "merge" | "replace" = "merge"
): Promise<ResumeResult<ResumeView & { skipped: number; notIncluded: number }>> {
  const profile = await ownerProfile();
  if (!profile) return fail("Sign in to edit your resume.");
  const row = await prisma.resume.findUnique({ where: { profileId: profile.id }, select: { id: true } });
  const existing = row ? await getResumeForProfile(profile.id) : null;
  // a stored-but-unreadable resume must not be silently replaced by a merge
  if (row && !existing && mode === "merge") {
    return fail("Your saved resume couldn't be read. Use “start over” to rebuild it from your log.");
  }
  // fresh drafts are fitted to the target page count; merge never trims
  const pages = existing?.pages ?? DEFAULT_RESUME_PAGES;
  const document =
    existing && mode === "merge"
      ? mergeResumeDocument(existing.document, profile)
      : generateResumeDocument(profile, [], { pages });
  const res = await writeResume(profile.id, document, { generatedAt: new Date() });
  if (!res.ok) return res;
  revalidatePath(`/${profile.username}/resume`);
  // events that didn't fit a full section — the editor tells the owner
  return {
    ok: true,
    data: {
      ...res.data,
      skipped: resumeOverflow(res.data.document, profile),
      notIncluded: resumeNotIncluded(res.data.document, profile),
    },
  };
}

export type SaveResumeInput = {
  document: unknown;
  template?: ResumeTemplate;
  pageSize?: ResumePageSize;
  pages?: ResumePageCount;
};

/** Editor autosave. The document is validated and href-scrubbed server-side
 *  (the returned view is what was stored); events removed since the last
 *  save become exclusions for regenerate. */
export async function saveResumeAction(input: SaveResumeInput): Promise<ResumeResult> {
  const ref = await ownerRef();
  if (!ref) return fail("Sign in to edit your resume.");
  if (input.template !== undefined && !isResumeTemplate(input.template)) return fail("Unknown template.");
  if (input.pageSize !== undefined && !isResumePageSize(input.pageSize)) return fail("Unknown page size.");
  if (input.pages !== undefined && !isResumePageCount(input.pages)) return fail("Pages must be 1–4.");
  const next = validateResumeDocument(input.document);
  if (!next.ok) return fail(next.error);

  const existing = await getResumeForProfile(ref.id);
  const res = await writeResume(ref.id, reconcileExclusions(existing?.document ?? null, next.document), {
    ...(input.template && { template: input.template }),
    ...(input.pageSize && { pageSize: input.pageSize }),
    ...(input.pages && { pages: input.pages }),
  });
  if (res.ok && res.data.published) revalidatePath(`/${ref.username}/resume`);
  return res;
}

/** Publish / unpublish /[username]/resume (and its llms.txt + MCP links). */
export async function setResumePublishedAction(published: boolean): Promise<ResumeResult> {
  const ref = await ownerRef();
  if (!ref) return fail("Sign in to edit your resume.");
  const res = await prisma.resume.updateMany({ where: { profileId: ref.id }, data: { published } });
  if (!res.count) return fail("Generate the resume first.");
  revalidatePath(`/${ref.username}/resume`);
  await revalidateForProfile(ref.id);
  const view = await getResumeForProfile(ref.id);
  return view ? { ok: true, data: view } : fail("Your saved resume couldn't be read.");
}

/** AI polish proposal (bullets, summary, template) for the owner to review —
 *  apply it client-side with applyPolish(), then save. Nothing is persisted. */
export async function polishResumeAction(document: unknown): Promise<ResumeResult<ResumePolish>> {
  const profile = await ownerProfile();
  if (!profile) return fail("Sign in to edit your resume.");
  const doc = validateResumeDocument(document);
  if (!doc.ok) return fail(doc.error);
  if (await rateLimited(`resume-polish:${profile.id}`, { max: 5 })) {
    return fail("Too many polish requests — try again in a minute.");
  }
  try {
    const { polishResume } = await import("@/lib/resume-ai");
    return { ok: true, data: await polishResume(profile, doc.document, SITE_URL) };
  } catch (e) {
    console.error("resume polish failed", e);
    return fail("AI polish is unavailable right now.");
  }
}
