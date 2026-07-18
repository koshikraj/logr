"use client";

// The /[username] page while the background import is still running: the real
// portfolio renders immediately (name, bio, any events already inserted), a
// status strip narrates exactly which source is being read, and extracted
// events pop into the timeline as each source completes. When the job
// finishes (events + bio/socials auto-published), it refreshes into the
// plain server-rendered page.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Portfolio from "@/components/Portfolio";
import { AgentAvatar } from "@/components/AgentAvatar";
import { profileBuildStatusAction, type ImportJobView } from "@/lib/actions";
import type { ProfileDTO, EventDTO, MediaItem } from "@/lib/profile";
import type { ReviewEvent, SourceChip } from "@/lib/import-types";

const POLL_MS = 2000;

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const disp = (iso: string, full: boolean) => {
  const [y, mo, d] = iso.split("-").map(Number);
  return full ? `${M[mo - 1]} ${d}, ${y}` : `${M[mo - 1]} ${y}`;
};

function toEventDTO(e: ReviewEvent, i: number): EventDTO {
  return {
    id: `building-${i}`,
    dateOn: e.dateOn,
    date: disp(e.dateOn, e.fullDate),
    year: Number(e.dateOn.slice(0, 4)),
    title: e.title,
    tags: e.tags,
    featured: e.featured,
    fullDate: e.fullDate,
    body: e.body,
    icon: null,
    link: null,
    sourceUrl: e.sourceUrl ?? null,
    media: e.media as MediaItem[],
  };
}

function chipState(c: SourceChip): string {
  switch (c.status) {
    case "queued":
      return "waiting";
    case "fetching":
      return "reading";
    case "extracting":
      return "extracting";
    case "done":
      return `${c.eventCount} event${c.eventCount === 1 ? "" : "s"}`;
    case "error":
      return "skipped";
  }
}

export function LiveBuilding({ profile, initial }: { profile: ProfileDTO; initial: ImportJobView }) {
  const router = useRouter();
  const [job, setJob] = useState<ImportJobView>(initial);

  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await profileBuildStatusAction(profile.username);
        if (cancelled) return;
        if (!next || next.status !== "running") {
          router.refresh(); // job finished & auto-published → real page
          return;
        }
        setJob(next);
      } catch {
        /* poll again */
      }
      t = setTimeout(tick, POLL_MS);
    };
    t = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [profile.username, router]);

  // Already-inserted events (typed story) + the ones streaming out of the job.
  const live = useMemo<ProfileDTO>(() => {
    const incoming = job.events.map(toEventDTO);
    const events = [...profile.events, ...incoming].sort((a, b) =>
      a.dateOn < b.dateOn ? 1 : a.dateOn > b.dateOn ? -1 : 0
    );
    return { ...profile, events };
  }, [profile, job.events]);

  const active = job.sources.find((s) => s.status === "fetching" || s.status === "extracting");

  return (
    <>
      <Portfolio profile={live} chatEnabled={false} />

      <div className="bld" role="status" aria-live="polite">
        <div className="bld__head">
          <AgentAvatar state="reading" size={14} className="agv-ondark" />
          <span className="bld__title">
            building this page
            {active ? ` — ${active.status === "fetching" ? "reading" : "extracting"} ${active.label}` : "…"}
          </span>
        </div>
        <ul className="bld__list">
          {job.sources.map((c) => (
            <li key={c.id} className={`bld__src bld__src--${c.status}`} title={c.error}>
              <span className="bld__src__label">{c.label}</span>
              <span className="bld__src__state">{chipState(c)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
