"use client";
/* The grounded-chat demo: questions type in, the answer streams — like the
   real /ask. setState inside the async loop is intentional. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Msg = { role: "user" | "ai"; text: string };

const QA = [
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

export function AskChat() {
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "idle">("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) {
      setHistory([
        { role: "user", text: QA[0].q },
        { role: "ai", text: QA[0].a },
      ]);
      return;
    }
    if (!inView) return; // paused off-screen
    (async () => {
      let i = 0;
      while (alive) {
        const { q, a } = QA[i % QA.length];
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
            <>{input}<span className="caret" /></>
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
