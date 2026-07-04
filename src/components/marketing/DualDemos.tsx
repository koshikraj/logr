"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Cartoon SVG illustrations ──────────────────────────────────────────

function ImgCode() {
  return (
    <svg viewBox="0 0 88 72" width="100%" height="72" aria-hidden="true" className="hv-img-svg">
      {/* warm bg */}
      <rect width="88" height="72" fill="#f0ece3" rx="3"/>
      {/* laptop base */}
      <rect x="6" y="50" width="76" height="8" rx="3" fill="#2a2520" opacity="0.72"/>
      {/* hinge notch */}
      <rect x="37" y="50" width="14" height="4" rx="2" fill="#1a1a1a" opacity="0.4"/>
      {/* screen frame */}
      <rect x="12" y="10" width="64" height="42" rx="3.5" fill="#2a2520" opacity="0.8"/>
      {/* screen glass */}
      <rect x="16" y="13.5" width="56" height="35" rx="2" fill="#111"/>
      {/* accent line at top of screen */}
      <rect x="16" y="13.5" width="56" height="2" rx="1" fill="#d85a30" opacity="0.6"/>
      {/* code lines */}
      <rect x="20" y="20" width="26" height="2.5" rx="1" fill="#d85a30" opacity="0.9"/>
      <rect x="20" y="26" width="40" height="2.5" rx="1" fill="#faf8f3" opacity="0.3"/>
      <rect x="24" y="32" width="30" height="2.5" rx="1" fill="#d85a30" opacity="0.6"/>
      <rect x="24" y="38" width="22" height="2.5" rx="1" fill="#faf8f3" opacity="0.25"/>
      <rect x="24" y="44" width="34" height="2.5" rx="1" fill="#faf8f3" opacity="0.18"/>
      {/* blinking cursor */}
      <rect x="60" y="44" width="2.5" height="2.5" rx="0.5" fill="#d85a30" opacity="0.95"/>
      {/* camera dot */}
      <circle cx="44" cy="12" r="1.5" fill="#d85a30" opacity="0.45"/>
      {/* status light */}
      <circle cx="79" cy="15" r="2.5" fill="#d85a30" opacity="0.5"/>
    </svg>
  );
}

function ImgTrophy() {
  return (
    <svg viewBox="0 0 88 72" width="100%" height="72" aria-hidden="true" className="hv-img-svg">
      {/* warm bg */}
      <rect width="88" height="72" fill="#f5efe6" rx="3"/>
      {/* glow behind trophy */}
      <ellipse cx="44" cy="38" rx="22" ry="16" fill="#d85a30" opacity="0.08"/>
      {/* base plate */}
      <rect x="31" y="59" width="26" height="5" rx="2" fill="#d85a30"/>
      <rect x="27" y="62" width="34" height="3" rx="1.5" fill="#c44f28"/>
      {/* stem */}
      <rect x="40" y="48" width="8" height="13" fill="#d85a30"/>
      {/* left handle */}
      <path d="M24,16 Q14,16 14,26 Q14,36 24,36" stroke="#d85a30" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* right handle */}
      <path d="M64,16 Q74,16 74,26 Q74,36 64,36" stroke="#d85a30" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* cup body */}
      <path d="M24,10 L64,10 L59,48 L29,48 Z" fill="#d85a30"/>
      {/* cup rim */}
      <ellipse cx="44" cy="10" rx="20" ry="6" fill="#e87050"/>
      {/* inner highlight */}
      <ellipse cx="38" cy="24" rx="5" ry="3.5" fill="#e87050" opacity="0.35" transform="rotate(-22,38,24)"/>
      {/* stars */}
      <text x="4" y="28" fontSize="11" fill="#d85a30" opacity="0.55">✦</text>
      <text x="70" y="26" fontSize="9" fill="#d85a30" opacity="0.45">✦</text>
      <text x="6" y="54" fontSize="6" fill="#d85a30" opacity="0.28">✦</text>
      <text x="74" y="50" fontSize="5" fill="#d85a30" opacity="0.22">✦</text>
      {/* "1st" badge */}
      <circle cx="44" cy="29" r="9" fill="#faf8f3" opacity="0.18"/>
      <text x="44" y="33" fontSize="10" fontFamily="monospace" fill="#faf8f3" textAnchor="middle" opacity="0.9">1st</text>
    </svg>
  );
}

function ImgCrowd() {
  return (
    <svg viewBox="0 0 88 72" width="100%" height="72" aria-hidden="true" className="hv-img-svg">
      {/* warm bg */}
      <rect width="88" height="72" fill="#f5efe6" rx="3"/>
      {/* confetti */}
      <rect x="5"  y="4"  width="9"  height="5" rx="2" fill="#d85a30" opacity="0.7"  transform="rotate(-18,9,6)"/>
      <rect x="26" y="2"  width="5"  height="9" rx="2" fill="#1a1a1a" opacity="0.28" transform="rotate(20,28,6)"/>
      <rect x="52" y="3"  width="8"  height="4" rx="2" fill="#d85a30" opacity="0.5"  transform="rotate(-12,56,5)"/>
      <rect x="70" y="6"  width="5"  height="7" rx="2" fill="#1a1a1a" opacity="0.22" transform="rotate(28,72,9)"/>
      <circle cx="18" cy="15" r="4"   fill="#d85a30" opacity="0.38"/>
      <circle cx="63" cy="9"  r="3"   fill="#d85a30" opacity="0.3"/>
      <circle cx="78" cy="20" r="2"   fill="#d85a30" opacity="0.25"/>
      <circle cx="6"  cy="26" r="1.5" fill="#d85a30" opacity="0.2"/>
      {/* person left */}
      <circle cx="18" cy="40" r="7" fill="#6b6862" opacity="0.65"/>
      <path d="M11,47 Q11,68 25,68 Q25,47 25,47 Z" fill="#6b6862" opacity="0.5"/>
      {/* person centre — winner, highlighted */}
      <circle cx="44" cy="37" r="8" fill="#d85a30" opacity="0.88"/>
      <path d="M36,45 Q36,68 52,68 Q52,45 52,45 Z" fill="#d85a30" opacity="0.72"/>
      {/* raised arm */}
      <path d="M51,46 Q60,35 68,28" stroke="#d85a30" strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.62"/>
      <circle cx="69" cy="26" r="3.5" fill="#d85a30" opacity="0.5"/>
      {/* person right */}
      <circle cx="70" cy="40" r="7" fill="#6b6862" opacity="0.55"/>
      <path d="M63,47 Q63,68 77,68 Q77,47 77,47 Z" fill="#6b6862" opacity="0.42"/>
    </svg>
  );
}

// ── Human Voice: animated timeline with icons + cartoon images ─────────

interface HVEntry {
  date: string;
  recency: "now" | "recent" | "mid";
  icon?: string;
  title: string;
  body: string;
  tweet?: { handle: string; text: string };
  imgVariant?: "hackathon";
}

const HV_ENTRIES: HVEntry[] = [
  {
    date: "2026.05",
    recency: "now",
    icon: "🚀",
    title: "launched logr. quiet, then not.",
    body: "shipped to the first 50. front page by the next morning.",
    tweet: {
      handle: "@rajkoshik",
      text: "logr is live. your whole story — for the humans who know you and the agents that don't. logr.life",
    },
  },
  {
    date: "2026.02",
    recency: "recent",
    icon: "🏆",
    title: "built zhentan. won the bnb openclaw hackathon.",
    body: "top project out of 600 builders. community spun up a token within hours.",
    imgVariant: "hackathon",
  },
  {
    date: "2025.11",
    recency: "mid",
    icon: "🎤",
    title: "devconnect, buenos aires.",
    body: "spoke on on-chain identity. one person in the room later joined.",
    tweet: {
      handle: "@rajkoshik",
      text: "just spoke on on-chain identity at devconnect BA. slides: zhentan.me/devconnect",
    },
  },
];

export function HumanVoiceDemo() {
  const [count, setCount] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) { setCount(HV_ENTRIES.length); return; }
    if (!inView) return; // paused off-screen
    (async () => {
      while (alive) {
        for (let n = 2; n <= HV_ENTRIES.length; n++) {
          if (!alive) return;
          await wait(2000);
          setCount(n);
        }
        await wait(2800);
        if (!alive) return;
        setCount(1);
        await wait(700);
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  const shown = HV_ENTRIES.slice(0, count);

  return (
    <div className="hv-timeline" ref={rootRef}>
      {shown.map((e) => (
        <div key={e.date} className={`hv-entry hv-entry--${e.recency}`}>
          <div className="hv-entry__meta">
            {e.icon && <span className="hv-entry__icon">{e.icon}</span>}
            <span className="hv-entry__date">{e.date}</span>
          </div>
          <div className="hv-entry__title">{e.title}</div>
          <p className="hv-entry__body">{e.body}</p>
          {e.imgVariant === "hackathon" && (
            <div className="hv-images">
              <ImgCode />
              <ImgTrophy />
              <ImgCrowd />
            </div>
          )}
          {e.tweet && (
            <div className="hv-tweet">
              <span className="hv-tweet__user">
                <span className="accent">{e.tweet.handle}</span>
                {" · x.com"}
              </span>
              <span className="hv-tweet__text">{e.tweet.text}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Machine Voice: live chat interface ────────────────────────────────

type Msg = { role: "user" | "ai"; text: string };

const MV_QA = [
  {
    q: "what's koshik working on?",
    a: "logr — a personal life-log for humans and AI agents. launched may 2026.",
  },
  {
    q: "has he won any hackathons?",
    a: "yes. the bnb openclaw hackathon with zhentan. 600 competitors, feb 2026.",
  },
  {
    q: "where is he based?",
    a: "bengaluru. building in crypto since 2018, security before that.",
  },
];

export function MachineVoiceChat() {
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "idle">("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) {
      setHistory([
        { role: "user", text: MV_QA[0].q },
        { role: "ai", text: MV_QA[0].a },
      ]);
      return;
    }
    if (!inView) return; // paused off-screen
    (async () => {
      let i = 0;
      while (alive) {
        const { q, a } = MV_QA[i % MV_QA.length];
        setPhase("typing"); setInput("");
        for (let c = 0; c <= q.length; c++) {
          if (!alive) return;
          setInput(q.slice(0, c));
          await wait(46);
        }
        await wait(320);
        if (!alive) return;
        setPhase("thinking"); setInput("");
        await wait(1100);
        if (!alive) return;
        // the answer streams in, like the real grounded chat
        setHistory((h) => [...h.slice(-2), { role: "user", text: q }, { role: "ai", text: "" }]);
        setPhase("idle");
        for (let c = 1; c <= a.length; c += 2) {
          if (!alive) return;
          const part = a.slice(0, c);
          setHistory((h) => [...h.slice(0, -1), { role: "ai", text: part }]);
          await wait(24);
        }
        setHistory((h) => [...h.slice(0, -1), { role: "ai", text: a }]);
        await wait(2600);
        i++;
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  return (
    <div className="mv-chat" ref={rootRef}>
      <div className="mv-chat__messages">
        {history.map((m, i) => (
          <div key={i} className={`mv-msg mv-msg--${m.role}`}>
            <span className="mv-msg__label">{m.role === "user" ? "you" : "logr.ai"}</span>
            <div className="mv-msg__bubble">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="mv-chat__input">
        <div className="mv-chat__input-box">
          {phase === "typing" && (
            <>{input}<span className="pw-compose__caret" /></>
          )}
          {phase === "thinking" && (
            <div className="pw-dots" aria-label="thinking"><span /><span /><span /></div>
          )}
        </div>
        <span className="mv-chat__send">ask →</span>
      </div>
    </div>
  );
}
