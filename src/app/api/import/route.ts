// Magical-onboarding import: accepts pasted sources + resume files, kicks off
// parallel background parsing, and streams ndjson progress. Processing is
// registered with after() (waitUntil on Vercel), so it keeps running to
// completion even if the client disconnects; per-source results persist to
// ImportJob/ImportSource, and the client re-attaches via getImportJobAction.

import { NextRequest } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { isChatEnabled } from "@/lib/chat";
import { classifySource } from "@/lib/import-classify";
import { isLinkedInApiEnabled } from "@/lib/import-sources";
import { extractPdfText, extractDocxText } from "@/lib/import";
import { processJob, MAX_SOURCES, MAX_FILES, JOB_TTL_MS, type JobInput } from "@/lib/import-job";
import type { ImportStreamEvent, SourceChip, SourceKind } from "@/lib/import-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // whole fan-out + merge budget (Fluid Compute)

const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const RUNNING_GRACE_MS = 10 * 60 * 1000; // a "running" job younger than this blocks a new one

// Best-effort per-instance rate limit (chat-route pattern).
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 3;
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

export async function POST(req: NextRequest) {
  if (!isChatEnabled()) {
    return Response.json({ error: "Import is not configured." }, { status: 503 });
  }
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (rateLimited(userId)) {
    return Response.json({ error: "Too many imports. Try again in a few minutes." }, { status: 429 });
  }

  // Lazy cleanup: consumed or stale jobs go away whenever a new one is asked for.
  await prisma.importJob.deleteMany({
    where: {
      userId,
      OR: [{ consumedAt: { not: null } }, { createdAt: { lt: new Date(Date.now() - JOB_TTL_MS) } }],
    },
  });

  // One live job at a time — the client re-attaches by polling.
  const running = await prisma.importJob.findFirst({
    where: { userId, status: "running", createdAt: { gt: new Date(Date.now() - RUNNING_GRACE_MS) } },
    select: { id: true },
  });
  if (running) return Response.json({ jobId: running.id }, { status: 409 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  // Re-classify URLs server-side — never trust the client's kind.
  let requested: Array<{ url?: string }>;
  try {
    requested = JSON.parse(String(form.get("sources") ?? "[]"));
    if (!Array.isArray(requested)) throw new Error();
  } catch {
    return Response.json({ error: "Bad sources payload" }, { status: 400 });
  }
  const classified = requested
    .map((s) => (typeof s?.url === "string" ? classifySource(s.url) : null))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s) => s.kind !== "linkedin" || isLinkedInApiEnabled())
    .filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i);

  // Uploaded files (resume / linkedin-pdf) — extracted to text up front; the
  // text lives only in this invocation, per-source DB rows are the durability.
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  let fileKinds: SourceKind[] = [];
  try {
    fileKinds = JSON.parse(String(form.get("fileKinds") ?? "[]"));
  } catch {
    /* default below */
  }
  const fileInputs: Array<{ kind: SourceKind; label: string; text: string }> = [];
  for (const [i, file] of files.slice(0, MAX_FILES).entries()) {
    if (file.size > FILE_SIZE_LIMIT) {
      return Response.json({ error: `${file.name} is too large (max 5 MB).` }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      return Response.json({ error: "Only PDF and DOCX files are supported." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    try {
      text = name.endsWith(".pdf") ? await extractPdfText(buffer) : await extractDocxText(buffer);
    } catch {
      return Response.json({ error: `Could not read ${file.name}.` }, { status: 400 });
    }
    const kind: SourceKind = fileKinds[i] === "linkedin-pdf" ? "linkedin-pdf" : "resume";
    fileInputs.push({ kind, label: file.name.slice(0, 60), text });
  }

  if (classified.length + fileInputs.length === 0) {
    return Response.json({ error: "Nothing to import." }, { status: 400 });
  }
  if (classified.length + fileInputs.length > MAX_SOURCES) {
    return Response.json({ error: `Too many sources (max ${MAX_SOURCES}).` }, { status: 400 });
  }

  const job = await prisma.importJob.create({
    data: {
      userId,
      sources: {
        create: [
          ...classified.map((s) => ({ kind: s.kind, url: s.url, label: s.label })),
          ...fileInputs.map((f) => ({ kind: f.kind, label: f.label })),
        ],
      },
    },
    include: { sources: true },
  });

  const chips: SourceChip[] = job.sources.map((s) => ({
    id: s.id,
    kind: s.kind as SourceKind,
    label: s.label,
    status: "queued",
    eventCount: 0,
  }));
  // DB rows and inputs were created from the same ordered array, so align by index.
  const inputs: JobInput[] = job.sources.map((s, i): JobInput => {
    if (i < classified.length) return { sourceId: s.id, kind: classified[i].kind, url: classified[i].url };
    const f = fileInputs[i - classified.length];
    return { sourceId: s.id, kind: f.kind, fileText: f.text };
  });

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null; // client gone — keep working, stop writing
    },
  });
  const emit = (e: ImportStreamEvent) => {
    try {
      controller?.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
    } catch {
      controller = null;
    }
  };

  emit({ type: "job", jobId: job.id, sources: chips });
  const processing = processJob(job.id, userId, inputs, emit).finally(() => {
    try {
      controller?.close();
    } catch {
      /* already closed */
    }
  });
  after(() => processing); // waitUntil semantics: outlive a client disconnect

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
