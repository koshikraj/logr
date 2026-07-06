import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { streamText, type ModelMessage } from "ai";
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

type InMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  if (!isChatEnabled()) {
    return Response.json({ error: "Chat is not configured." }, { status: 503 });
  }

  const ipRaw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const visitor = createHash("sha256").update(ipRaw).digest("hex").slice(0, 16);
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

  const profile = await getProfile(username);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  const origin = req.nextUrl.origin;
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

  const result = streamText({
    model: openrouter.chat(CHAT_MODEL),
    system: buildSystemPrompt(profile, origin),
    messages,
    maxOutputTokens: MAX_TOKENS,
    temperature: 0.3,
    onFinish: async ({ text }) => {
      // log the exchange for the owner's "what people ask" analytics
      try {
        await prisma.chatMessage.createMany({
          data: [
            { profileId: profile.id, sessionId, role: "user", content: String(lastUser), visitor },
            { profileId: profile.id, sessionId, role: "assistant", content: text, visitor },
          ],
        });
      } catch {
        /* logging is best-effort */
      }
    },
  });

  return result.toTextStreamResponse();
}
