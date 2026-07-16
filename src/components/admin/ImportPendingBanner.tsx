"use client";

// Dashboard wait state while the background import is still assembling the
// page. Events, bio, and socials auto-publish server-side when the job
// finishes — this just shows progress, then refreshes to reveal the results.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getImportJobAction, type ImportJobView } from "@/lib/actions";

const POLL_MS = 3000;

export function ImportPendingBanner({ initial }: { initial: ImportJobView }) {
  const router = useRouter();
  const [job, setJob] = useState<ImportJobView>(initial);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (gone) return;
    const t = setTimeout(async () => {
      try {
        const next = await getImportJobAction();
        if (next && next.status === "running") {
          setJob(next);
        } else {
          // finished (and auto-published) or expired — show the real data
          setGone(true);
          router.refresh();
        }
      } catch {
        /* retry on next tick */
      }
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [job, gone, router]);

  if (gone) return null;

  const doneCount = job.sources.filter((s) => s.status === "done" || s.status === "error").length;
  const found = job.events.length;

  return (
    <div className="card" style={{ borderLeft: "2px solid var(--user-accent, currentColor)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="onb__dots" aria-hidden="true"><span /><span /><span /></span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
          your page is getting ready — reading your sources ({doneCount}/{job.sources.length}
          {found > 0 ? `, ${found} event${found === 1 ? "" : "s"} so far` : ""})
        </span>
      </div>
    </div>
  );
}
