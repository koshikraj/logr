import { NextRequest } from "next/server";
import { after } from "next/server";
import { createHash } from "crypto";
import { streamText, generateText, smoothStream, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import {
  isChatEnabled,
  buildSystemPrompt,
  CHAT_MODEL,
  MAX_TOKENS,
  MAX_INPUT_CHARS,
  MAX_HISTORY,
} from "@/lib/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Best-effort per-instance rate limit (swap for Upstash Redis in production).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.reset) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > MAX_PER_WINDOW;
}

// Per-instance system-prompt cache: the prompt only changes when the profile
// does, yet building it costs a full profile+events+media query — the single
// largest chunk of time-to-first-token. 60s of staleness is an acceptable
// trade (same one the rate limiter makes); dashboard edits reach chat within
// a minute. Keyed by origin too, since the prompt embeds absolute URLs.
const PROMPT_TTL_MS = 60_000;
const promptCache = new Map<string, { system: string; profileId: string; at: number }>();

async function cachedSystemPrompt(username: string, origin: string) {
  const key = `${origin}|${username}`;
  const hit = promptCache.get(key);
  if (hit && Date.now() - hit.at < PROMPT_TTL_MS) return hit;
  const profile = await getProfile(username);
  if (!profile) return null;
  const entry = {
    system: buildSystemPrompt(profile, origin),
    profileId: profile.id,
    at: Date.now(),
  };
  promptCache.set(key, entry);
  return entry;
}

function visitorHash(req: NextRequest): string {
  const ipRaw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  return createHash("sha256").update(ipRaw).digest("hex").slice(0, 16);
}

// Personalized ask suggestions: one small LLM call per profile per TTL,
// grounded by construction (the model only sees the log). Made against the
// SAME cached system prompt with the SAME cacheControl marker as POST, so
// generating suggestions doubles as writing the provider's prompt cache —
// the visitor's first real question then reads it. Failures aren't cached:
// suggestions are a bonus, the warmup already did its job.
const SUGGEST_TTL_MS = 10 * 60_000;
const SUGGEST_COUNT = 2;
const SUGGEST_GEN = 3; // over-generate: the length/shape filter eats some
const suggestCache = new Map<string, { list: string[]; at: number }>();
const suggestInflight = new Map<string, Promise<string[]>>();

const SUGGEST_PROMPT = [
  `Write ${SUGGEST_GEN} short questions a first-time visitor could ask, answerable entirely from the log above.`,
  "Make them specific — name actual projects, events, or milestones from the log (prefer pinned, recent, or featured ones). No generic questions.",
  "Each under 40 characters, all lowercase, ending with a question mark.",
  "Output the questions only, one per line — no numbering, bullets, or quotes.",
].join(" ");

function parseSuggestions(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s\d.\-•*>]+/, "").replace(/^["']|["']$/g, "").trim().toLowerCase())
    .filter((l) => l.length >= 8 && l.length <= 48 && l.endsWith("?"))
    .slice(0, SUGGEST_COUNT);
}

async function cachedSuggestions(prompt: { system: string; profileId: string }): Promise<string[]> {
  const hit = suggestCache.get(prompt.profileId);
  if (hit && Date.now() - hit.at < SUGGEST_TTL_MS) return hit.list;
  const inflight = suggestInflight.get(prompt.profileId);
  if (inflight) return inflight; // concurrent visitors share one generation
  const job = (async () => {
    try {
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
      const { text } = await generateText({
        model: openrouter.chat(CHAT_MODEL),
        messages: [
          {
            role: "system",
            content: prompt.system,
            providerOptions: { openrouter: { cacheControl: { type: "ephemeral" } } },
          },
          { role: "user", content: SUGGEST_PROMPT },
        ],
        maxOutputTokens: 100,
        temperature: 0.8,
      });
      const list = parseSuggestions(text);
      if (list.length) suggestCache.set(prompt.profileId, { list, at: Date.now() });
      return list;
    } catch {
      return [];
    } finally {
      suggestInflight.delete(prompt.profileId);
    }
  })();
  suggestInflight.set(prompt.profileId, job);
  return job;
}

/**
 * Warmup + personalized suggestions. The profile page fires this on load so
 * the visitor's FIRST question streams against warm caches — profile/prompt
 * cache, DB connection, provider prompt cache — instead of paying for all
 * three. Returns a couple of log-specific questions the client mixes in
 * ahead of the templated seeds.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  if (!isChatEnabled()) return Response.json({ suggestions: [] });

  // separate bucket from POST so warmups never eat into the chat budget
  if (rateLimited(`warm:${visitorHash(req)}`)) {
    return Response.json({ suggestions: [] }, { status: 429 });
  }

  const { username } = await params;
  const prompt = await cachedSystemPrompt(username, req.nextUrl.origin);
  if (!prompt) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ suggestions: await cachedSuggestions(prompt) });
}

type InMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  if (!isChatEnabled()) {
    return Response.json({ error: "Chat is not configured." }, { status: 503 });
  }

  const visitor = visitorHash(req);
  if (rateLimited(visitor)) {
    return Response.json({ error: "Too many messages. Try again in a minute." }, { status: 429 });
  }

  const { username } = await params;
  let body: { sessionId?: string; messages?: InMsg[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const sessionId = (body.sessionId || "").slice(0, 64) || "anon";
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // keep recent turns, sanitize, cap input length
  const messages: ModelMessage[] = incoming
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT_CHARS) }));

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content;
  if (!lastUser) return Response.json({ error: "No question" }, { status: 400 });

  const prompt = await cachedSystemPrompt(username, req.nextUrl.origin);
  if (!prompt) return Response.json({ error: "Not found" }, { status: 404 });

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

  const result = streamText({
    model: openrouter.chat(CHAT_MODEL),
    messages: [
      {
        role: "system",
        content: prompt.system,
        // Anthropic prompt caching (5-min TTL) via OpenRouter: follow-up
        // questions skip re-processing the ~6k-token log — faster first
        // token, ~90% cheaper input.
        providerOptions: { openrouter: { cacheControl: { type: "ephemeral" } } },
      },
      ...messages,
    ],
    maxOutputTokens: MAX_TOKENS,
    temperature: 0.3,
    // word-paced release reads smoother than raw network chunks
    experimental_transform: smoothStream(),
  });

  // log the exchange for the owner's "what people ask" analytics —
  // after() runs once the response has streamed, without holding it open
  after(async () => {
    try {
      const text = await result.text;
      await prisma.chatMessage.createMany({
        data: [
          { profileId: prompt.profileId, sessionId, role: "user", content: String(lastUser), visitor },
          { profileId: prompt.profileId, sessionId, role: "assistant", content: text, visitor },
        ],
      });
    } catch {
      /* logging is best-effort */
    }
  });

  return result.toTextStreamResponse();
}
