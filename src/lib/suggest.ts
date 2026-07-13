import type { ProfileDTO } from "@/lib/profile";

/**
 * Seed questions for the ask launcher and chat empty state — templated from
 * the profile's own structured data, so every question is answerable from
 * the log *by construction* (the grounded chat's core promise). No LLM, no
 * queries: pure string selection over the already-loaded DTO.
 */
export function seedQuestions(profile: ProfileDTO): string[] {
  const first = (profile.name.trim().split(/\s+/)[0] || "them").toLowerCase();
  const out: string[] = [];

  if (profile.status) out.push(`what is ${first} building now?`);

  // a featured event with a slot-friendly title gets name-dropped — the
  // strongest hook, but only when the title reads naturally in a question
  const hero = profile.events.find((e) => e.featured);
  const heroTitle = hero ? slotTitle(hero.title) : null;
  if (heroTitle) out.push(`what's the story behind ${heroTitle}?`);

  // tag presence guarantees the log can answer the capability question
  const tags = new Set(profile.events.flatMap((e) => e.tags));
  if (tags.has("talk")) out.push(`what talks has ${first} given?`);
  if (tags.has("writing")) out.push(`what has ${first} written?`);
  if (tags.has("side_quest")) out.push(`what does ${first} do beside work?`);

  // generic closers so there are always enough
  out.push("what have they shipped?", "what's their background?");

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
