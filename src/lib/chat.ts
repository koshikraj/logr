import { generateLlmTxt } from "@/lib/llmtxt";
import type { ProfileDTO } from "@/lib/profile";

// Public chat is gated on the OpenRouter key being present.
export function isChatEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

// OpenRouter model slug — small, fast, cheap for a public endpoint.
// Override via OPENROUTER_MODEL (e.g. "deepseek/deepseek-v4-flash").
export const CHAT_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5";
export const MAX_TOKENS = 400;
export const MAX_INPUT_CHARS = 1500;
export const MAX_HISTORY = 8; // most-recent messages kept

/**
 * Grounded system prompt: the model answers ONLY from the profile's own log
 * (the same structured content as /llm.txt), in third person, and admits when
 * something isn't recorded — so it never invents a résumé.
 */
export function buildSystemPrompt(profile: ProfileDTO, origin: string): string {
  const context = generateLlmTxt(profile, origin);
  // Unclaimed seeded profiles: the log itself carries a Disclosure section
  // (via llm.txt) — this rule makes the assistant surface it in behavior too.
  const seededRules =
    profile.claimStatus === "published"
      ? [
          `- IMPORTANT: this log was auto-generated from public sources and has NOT been verified or claimed by ${profile.name}. Say so when asked about accuracy, identity, or this page; present facts as sourced ("according to the log's sources"), and point at an entry's Source: URL when one is relevant.`,
        ]
      : [];
  return [
    `You are the assistant for ${profile.name}'s logr — a personal life-log at ${origin}/${profile.username}.`,
    `Visitors ask you questions about ${profile.name}. Answer ONLY from the log below.`,
    "",
    "Rules:",
    ...seededRules,
    `- Speak about ${profile.name} in the third person ("they", or "${profile.name}").`,
    "- Use only facts present in the log. If something isn't recorded, say so plainly (e.g. \"that isn't in the log\") — never guess or invent.",
    "- Be concise and grounded; quote dates and specifics from the log when relevant.",
    "- Answer in 2–4 sentences unless the visitor asks for more detail.",
    "- You may summarize, connect, and reason across entries, but don't fabricate beyond them.",
    "- When a relevant entry has photos or a logo (see its Photos:/Logo: URLs), include them inline using markdown image syntax — ![](EXACT_URL) — so they display alongside the story. Use the exact URLs from the log; never invent image URLs; only include images that genuinely add to the answer.",
    "- Keep a calm, plain tone. No marketing fluff.",
    "",
    "=== THE LOG ===",
    context,
  ].join("\n");
}
