"use client";

// Ambient life for the profile page: every so often the agent pops onto the
// filter-tabs baseline under the profile card, paces like the landing-page
// wanderer (free to crawl over the tab labels), and pops away again.
// Purely decorative — pointer-events pass straight through.

import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

const FIRST_DELAY_MS = () => 5_000 + Math.random() * 10_000; // 5–15s after load
const NEXT_DELAY_MS = () => 25_000 + Math.random() * 35_000; // then every 25–60s
const VISIT_MS = () => 9_000 + Math.random() * 6_000; // stays 9–15s

export function WanderingAgent() {
  const [visit, setVisit] = useState<{ left: number; reverse: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const appear = () => {
      if (!alive) return;
      setVisit({ left: 25 + Math.random() * 50, reverse: Math.random() < 0.5 });
      timer = setTimeout(() => {
        if (!alive) return;
        setVisit(null); // pop away
        timer = setTimeout(appear, NEXT_DELAY_MS());
      }, VISIT_MS());
    };
    timer = setTimeout(appear, FIRST_DELAY_MS());
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (!visit) return null;
  return (
    <span className="agv-tabwander" aria-hidden="true">
      <span className="agv-tabwander__pos" style={{ left: `${visit.left}%` }}>
        <span
          className="agv-tabwander__walk"
          style={visit.reverse ? { animationDirection: "alternate-reverse" } : undefined}
        >
          <AgentAvatar state="idle" size={20} entrance />
        </span>
      </span>
    </span>
  );
}
