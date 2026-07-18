"use client";

// Ambient life for the top bar: every so often the agent pops onto the bar's
// baseline at a random spot, paces a little, and pops away again. Purely
// decorative — pointer-events pass straight through.

import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

const FIRST_DELAY_MS = () => 5_000 + Math.random() * 10_000; // 5–15s after load
const NEXT_DELAY_MS = () => 25_000 + Math.random() * 35_000; // then every 25–60s
const VISIT_MS = () => 7_000 + Math.random() * 5_000; // stays 7–12s

export function WanderingAgent() {
  const [visit, setVisit] = useState<{ left: number; reverse: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const appear = () => {
      if (!alive) return;
      setVisit({ left: 18 + Math.random() * 55, reverse: Math.random() < 0.5 });
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
    <span className="agv-barwander" style={{ left: `${visit.left}%` }} aria-hidden="true">
      <span
        className="agv-barwander__walk"
        style={visit.reverse ? { animationDirection: "reverse" } : undefined}
      >
        <AgentAvatar state="idle" size={15} entrance />
      </span>
    </span>
  );
}
