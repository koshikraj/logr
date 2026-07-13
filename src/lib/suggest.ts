import type { ProfileDTO } from "@/lib/profile";

/**
 * Seed questions for the ask launcher and chat empty state — templated from
 * the profile's own structured data, so every question is answerable from
 * the log *by construction* (the grounded chat's core promise). No LLM, no
 * queries: pure string selection over the already-loaded DTO.
 *
 * Wording is entity-neutral: a logr can be a person, a brand, a community
 * or a project, so questions avoid pronouns and person-only activities
 * ("talks given", "beside work") — the subject is always the name, and the
 * activities are the tags the profile actually logged. (Per-kind voice and
 * owner-curated questions are tracked in a follow-up issue.)
 */
export function seedQuestions(profile: ProfileDTO): string[] {
  const who = (profile.name.trim().split(/\s+/)[0] || "them").toLowerCase();
  const out: string[] = [];

  if (profile.status) out.push(`what is ${who} up to right now?`);

  // a featured event with a slot-friendly title gets name-dropped — the
  // strongest hook, but only when the title reads naturally in a question
  const hero = profile.events.find((e) => e.featured);
  const heroTitle = hero ? slotTitle(hero.title) : null;
  if (heroTitle) out.push(`what's the story behind ${heroTitle}?`);

  // tag presence guarantees the log can answer the capability question
  const tags = new Set(profile.events.flatMap((e) => e.tags));
  if (tags.has("milestone")) out.push("what are the biggest milestones?");
  if (tags.has("work")) out.push(`what has ${who} launched?`);
  if (tags.has("writing")) out.push(`what has ${who} published?`);
  if (tags.has("talk")) out.push("any talks or events?");
  if (tags.has("side_quest")) out.push("what happens off the main track?");

  // a log with real history invites the origin question
  const years = profile.events.length
    ? new Date().getFullYear() - Math.min(...profile.events.map((e) => e.year))
    : 0;
  if (years >= 3) out.push(`how did ${who} start?`);

  // generic closers so there are always enough
  out.push("what's the story so far?", "what's new recently?");

  const seen = new Set<string>();
  // the launcher pill is ~200px of mono type — keep phrases short
  return out
    .filter((q) => q.length <= 42 && !seen.has(q) && seen.add(q))
    .slice(0, 4);
}

/** A title only slots into "the story behind …" when it's short free text —
 *  long editorial titles read badly mid-question, so they're skipped. */
function slotTitle(title: string): string | null {
  const t = title.replace(/[.!?…]+$/, "").trim();
  if (!t || t.length > 24 || t.split(/\s+/).length > 4) return null;
  return t.toLowerCase();
}
