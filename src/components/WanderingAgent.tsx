"use client";

// Ambient life for the profile page: every so often the agent pops onto the
// filter-tabs baseline under the profile card and walks the whole row end to
// end — crawling right over the tab labels — then exits off the far edge.
// Purely decorative — pointer-events pass straight through.

import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

const FIRST_DELAY_MS = () => 5_000 + Math.random() * 10_000; // 5–15s after load
const NEXT_DELAY_MS = () => 25_000 + Math.random() * 35_000; // then every 25–60s
const CROSS_MS = () => 12_000 + Math.random() * 6_000; // one full crossing takes 12–18s

type Visit = { reverse: boolean; duration: number };

export function WanderingAgent() {
  const [visit, setVisit] = useState<Visit | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    timerRef.current = setTimeout(appear, FIRST_DELAY_MS());
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function appear() {
    if (!aliveRef.current) return;
    setVisit({ reverse: Math.random() < 0.5, duration: CROSS_MS() });
  }

  function crossed(e: React.AnimationEvent) {
    // child animations (drop entrance, bob, blink) bubble here too
    if (e.animationName !== "agv-cross") return;
    setVisit(null);
    timerRef.current = setTimeout(appear, NEXT_DELAY_MS());
  }

  if (!visit) return null;
  return (
    <span className="agv-tabwander" aria-hidden="true">
      <span
        className="agv-tabwander__cross"
        style={{
          animationDuration: `${visit.duration}ms`,
          animationDirection: visit.reverse ? "reverse" : "normal",
        }}
        onAnimationEnd={crossed}
      >
        <AgentAvatar state="idle" size={20} entrance />
      </span>
    </span>
  );
}
