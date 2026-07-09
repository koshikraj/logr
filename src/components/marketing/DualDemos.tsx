"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Human Voice: animated timeline with icons + photos ─────────────────

interface HVEntry {
  date: string;
  recency: "now" | "recent" | "mid";
  icon?: string;
  title: string;
  body: string;
  tweet?: { handle: string; text: string };
  photos?: string[];
}

const HV_ENTRIES: HVEntry[] = [
  {
    date: "2026.06",
    recency: "now",
    icon: "/icons/cipher-boss.svg",
    title: "kicked off 'obfuscation: the final boss of cryptography'.",
    body: "part i of a new series on the blog.",
  },
  {
    date: "2023.11",
    recency: "recent",
    icon: "/icons/optimism-path.svg",
    title: "wrote 'my techno-optimism'.",
    body: "warm but nuanced — the direction of progress matters, not just the magnitude.",
    photos: ["/marketing/vit-techno.png", "/marketing/vit-endgame.png"],
  },
  {
    date: "2022.02",
    recency: "mid",
    icon: "/icons/split-diamond.svg",
    title: "said it plainly, the day the war began.",
    body: "and endorsed the crypto projects supporting ukraine.",
    tweet: {
      handle: "@VitalikButerin",
      text: "Ethereum is neutral, but I am not.",
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
            {e.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="hv-entry__icon" src={e.icon} alt="" width="20" height="20" />
            )}
            <span className="hv-entry__date">{e.date}</span>
          </div>
          <div className="hv-entry__title">{e.title}</div>
          <p className="hv-entry__body">{e.body}</p>
          {e.photos && (
            <div className="hv-images">
              {e.photos.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} className="hv-img-svg" src={src} alt="" height="72" style={{ objectFit: "cover" }} />
              ))}
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
    q: "what has vitalik been up to?",
    a: "he just kicked off obfuscation — a new series he calls the final boss of cryptography.",
  },
  {
    q: "what about ai?",
    a: "'my response to ai 2027', july 2025 — skeptical of timelines that fast.",
  },
  {
    q: "and the famous tweet?",
    a: "feb 24, 2022: \"Ethereum is neutral, but I am not.\"",
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
