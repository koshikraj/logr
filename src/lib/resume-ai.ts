// Optional AI polish for the resume builder (#66): rewrite item bodies into
// resume bullets, draft a summary, and suggest a template. Grounded like the
// visitor chat — the model sees only the profile's own log and may not add
// facts. Returns a proposal for the owner to review; nothing is saved here.

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isChatEnabled, CHAT_MODEL } from "@/lib/chat";
import { generateLlmTxt } from "@/lib/llmtxt";
import type { ProfileDTO } from "@/lib/profile";
import {
  isResumeTemplate,
  RESUME_TEMPLATES,
  suggestTemplate,
  type ResumeDocument,
  type ResumePolish,
} from "@/lib/resume";

const MAX_ITEMS = 40;

export function buildPolishPrompt(profile: ProfileDTO, doc: ResumeDocument, origin: string): string {
  const items = doc.sections
    .filter((s) => !s.hidden)
    .flatMap((s) =>
      s.items.map((i) => ({
        id: i.id,
        section: s.type,
        source: i.eventId ? "log" : "owner-written",
        title: i.title,
        bullets: i.bullets,
      }))
    )
    .slice(0, MAX_ITEMS);
  return [
    `Rewrite ${profile.name}'s resume content. Never invent employers, numbers, titles, dates, or outcomes.`,
    "Grounding: an item's bullets may use only facts from that item's own title and bullets, plus — for source \"log\" items — the matching entry in THE LOG. Never move facts between items. The summary uses only THE LOG.",
    "",
    "Return:",
    "- summary: 2–3 sentences, third-person-free resume voice (no \"I\", no name), what they do and their strongest recorded work. null if the log is too thin.",
    `- template: the best fit from ${RESUME_TEMPLATES.join(" | ")} — classic for corporate/traditional roles, modern for engineers/product, founder for builders with many projects, academic for talks/writing-heavy logs, creative for designers/makers with visual work.`,
    "- bullets: for each item id, 1–3 concise resume bullets starting with a strong verb, past tense for past work. Keep concrete specifics (names, dates, numbers) that appear in the source. Drop filler.",
    "",
    "ITEMS (JSON):",
    JSON.stringify(items),
    "",
    "=== THE LOG ===",
    generateLlmTxt(profile, origin).slice(0, 24000),
  ].join("\n");
}

/** Leniently parse the model's JSON; unknown ids and empty bullets are dropped. */
export function parsePolish(raw: string, doc: ResumeDocument): ResumePolish {
  const fallback: ResumePolish = { summary: null, template: suggestTemplate(doc), bullets: {} };
  const s = raw.replace(/```[a-z]*/gi, "").replace(/```/g, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return fallback;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(s.slice(a, b + 1));
  } catch {
    return fallback;
  }
  const ids = new Set(doc.sections.flatMap((sec) => sec.items.map((i) => i.id)));
  const bullets: Record<string, string[]> = {};
  const rawBullets = obj.bullets;
  if (rawBullets && typeof rawBullets === "object") {
    for (const [id, list] of Object.entries(rawBullets as Record<string, unknown>)) {
      if (!ids.has(id) || !Array.isArray(list)) continue;
      const clean = list
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.replace(/^[-•*\s]+/, "").trim().slice(0, 400))
        .filter(Boolean)
        .slice(0, 3);
      if (clean.length) bullets[id] = clean;
    }
  }
  return {
    summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim().slice(0, 2000) : null,
    template: isResumeTemplate(obj.template) ? obj.template : fallback.template,
    bullets,
  };
}

export async function polishResume(profile: ProfileDTO, doc: ResumeDocument, origin: string): Promise<ResumePolish> {
  if (!isChatEnabled()) throw new Error("AI is not configured.");
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
  const { text } = await generateText({
    model: openrouter.chat(process.env.OPENROUTER_RESUME_MODEL || CHAT_MODEL),
    system:
      "You output ONLY a raw JSON object — no prose, no markdown fences. " +
      'Shape: {"summary":string|null,"template":string,"bullets":{"<item id>":string[]}}. ' +
      "You are a precise resume editor. Every claim must be supported by the provided log; when unsure, keep the original wording.",
    prompt: buildPolishPrompt(profile, doc, origin),
    temperature: 0.3,
  });
  return parsePolish(text, doc);
}
