// Event persistence shared by server actions and the background import job
// (actions.ts is "use server" and can't be imported from route handlers).

import { prisma } from "@/lib/db";
import type { ReviewEvent } from "@/lib/import-types";

/** Known tags pass through; customs are normalized (lowercase, collapsed
 *  whitespace, length-capped) and deduped. Tags are free-form by design —
 *  the display layer falls back to the raw string for unknown keys. */
export function sanitizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((t) => String(t).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24))
        .filter(Boolean)
    )
  ).slice(0, 12);
}

/** Bulk-insert extracted events (newest get the top slots). */
export async function insertEventsForProfile(profileId: string, events: ReviewEvent[]) {
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
          tags: sanitizeTags(e.tags),
          featured: !!e.featured,
          body: e.body ?? "",
          icon: e.icon?.trim() || null,
          linkLabel: e.linkLabel?.trim() || null,
          linkHref: e.linkHref?.trim() || null,
          sourceUrl: e.sourceUrl ?? null,
          provenance: e.sourceUrl ? "userImported" : "userCreated",
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
}
