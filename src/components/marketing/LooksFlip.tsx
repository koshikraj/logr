"use client";
/* The "give it any look" flip from the launch promo: the same vitalik log
   re-skins itself every few beats — palette and layout swap together, the
   background crossfades, rows settle back in. */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

type Stage = {
  label: string;
  layout: "timeline" | "terminal" | "polaroid" | "magazine";
  paper: string;
  ink: string;
  accent: string;
  muted: string;
  faint: string;
  rule: string;
  chip: string; // background behind the entry icons
};

// palettes lifted from the promo: paper, ink (dark), sepia
const STAGES: Stage[] = [
  { label: "paper · timeline", layout: "timeline", paper: "#FAF8F3", ink: "#1A1A1A", accent: "#D85A30", muted: "#6B6862", faint: "#95918A", rule: "rgba(26,26,26,0.14)", chip: "rgba(255,255,255,0.65)" },
  { label: "ink · terminal", layout: "terminal", paper: "#1A1814", ink: "#F2EFE8", accent: "#D85A30", muted: "#8E8A82", faint: "#5F5C56", rule: "rgba(242,239,232,0.16)", chip: "#F2EFE8" },
  { label: "sepia · polaroid", layout: "polaroid", paper: "#F4EBD9", ink: "#241E14", accent: "#C24A20", muted: "#6B6046", faint: "#95886B", rule: "rgba(36,30,20,0.16)", chip: "#fff" },
  { label: "paper · magazine", layout: "magazine", paper: "#FAF8F3", ink: "#1A1A1A", accent: "#D85A30", muted: "#6B6862", faint: "#95918A", rule: "rgba(26,26,26,0.14)", chip: "rgba(255,255,255,0.65)" },
];

const EVENTS = [
  { date: "2026.06", title: "kicked off 'obfuscation: the final boss of cryptography'", tag: "writing", icon: "/icons/cipher-boss.svg" },
  { date: "2015", title: "deployed the ethereum blockchain", tag: "milestone", icon: "/icons/blockchain.svg" },
  { date: "2013.11", title: "published the ethereum white paper", tag: "writing", icon: "/icons/whitepaper.svg" },
];

const HOLD_MS = 2600;

export function LooksFlip() {
  const [stage, setStage] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    // reduced motion: stay on the first look
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!inView) return; // paused off-screen
    const id = setInterval(() => setStage((s) => (s + 1) % STAGES.length), HOLD_MS);
    return () => clearInterval(id);
  }, [inView]);

  const t = STAGES[stage];

  return (
    <div className="lflip" ref={rootRef} style={{ background: t.paper, borderColor: t.rule }}>
      {/* profile header — same person, whatever the look */}
      <div className="lflip__head" style={{ borderColor: t.rule }}>
        <span className="lflip__ava" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marketing/vitalik.jpg" alt="" width="40" height="40" />
        </span>
        <span className="lflip__id">
          <span className="lflip__name" style={{ color: t.ink }}>vitalik buterin</span>
          <span className="lflip__handle" style={{ color: t.muted }}>
            logr.it<span style={{ color: t.accent }}>/</span>vitalik
          </span>
        </span>
        <span className="lflip__pill" style={{ color: t.faint, borderColor: t.rule }}>{t.label}</span>
      </div>

      {/* entries — remounted per stage so rows settle back in */}
      <div className="lflip__rows" key={stage}>
        {EVENTS.map((e, i) => {
          const isNow = i === 0;
          return (
            <div key={e.date} className="lflip__row" style={{ animationDelay: `${i * 90}ms` }}>
              <span className="lflip__lead" aria-hidden="true">
                {t.layout === "terminal" ? (
                  <span style={{ color: t.accent, fontFamily: "var(--mono)", fontSize: 13 }}>&gt;</span>
                ) : t.layout === "magazine" ? (
                  <span style={{ color: t.accent, fontFamily: "var(--mono)", fontSize: 11 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                ) : (
                  <span
                    className="lflip__dot"
                    style={{
                      background: isNow ? t.accent : t.ink,
                      opacity: isNow ? 1 : 0.55,
                      width: isNow ? 9 : 6,
                      height: isNow ? 9 : 6,
                    }}
                  />
                )}
              </span>
              <span className="lflip__date" style={{ color: t.muted }}>
                {t.layout === "terminal" ? `[${e.date}]` : e.date}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={`lflip__icon${t.layout === "polaroid" ? " lflip__icon--pol" : ""}`}
                src={e.icon}
                alt=""
                width="30"
                height="30"
                style={{
                  background: t.layout === "polaroid" ? "#fff" : t.chip,
                  borderColor: t.rule,
                }}
              />
              <span className="lflip__text">
                <span
                  className="lflip__title"
                  style={{
                    color: t.ink,
                    fontFamily: t.layout === "terminal" ? "var(--mono)" : "var(--serif)",
                    fontWeight: t.layout === "magazine" ? 600 : 400,
                    fontSize: t.layout === "terminal" ? 12.5 : 14.5,
                  }}
                >
                  {e.title}
                  {t.layout === "terminal" && isNow ? (
                    <span className="lflip__block" style={{ background: t.accent }} />
                  ) : null}
                </span>
                <span
                  className="lflip__tag"
                  style={{
                    color: t.faint,
                    textTransform: t.layout === "magazine" ? "uppercase" : "none",
                    letterSpacing: t.layout === "magazine" ? "0.14em" : "0.03em",
                  }}
                >
                  · {e.tag}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
