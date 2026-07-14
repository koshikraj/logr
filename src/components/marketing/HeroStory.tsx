"use client";
/* The hero's proof-in-motion: one narrated line forks into two readers —
   a human timeline entry and an agent ingesting llm.txt. setState inside
   the async loop is intentional. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MOMENTS = [
  { date: "2026.03", text: "ran a half marathon." },
  { date: "2026.07", text: "shipped my first app." },
  { date: "2026.11", text: "met my hero at devcon." },
];

// who's on each side of the fork
const HUMAN_READERS = [
  { src: "/marketing/readers/chrome.svg", name: "chrome" },
  { src: "/marketing/readers/safari.svg", name: "safari" },
  { src: "/marketing/readers/firefox.svg", name: "firefox" },
];
const AGENT_READERS = [
  { src: "/marketing/readers/claude.svg", name: "claude code" },
  { src: "/marketing/readers/openai.svg", name: "openai codex" },
  { src: "/marketing/readers/gemini.svg", name: "gemini" },
  { src: "/marketing/readers/hermes.png", name: "hermes" },
];

function Who({ readers }: { readers: typeof HUMAN_READERS }) {
  return (
    <span className="hstage__who">
      {readers.map((r) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={r.name} src={r.src} alt="" title={r.name} width="16" height="16" />
      ))}
    </span>
  );
}

export function HeroStory() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [readers, setReaders] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) {
      setTyped(MOMENTS[0].text);
      setReaders(true);
      return;
    }
    if (!inView) return; // paused off-screen
    (async () => {
      let i = 0;
      while (alive) {
        const m = MOMENTS[i % MOMENTS.length];
        for (let c = 0; c <= m.text.length; c++) {
          if (!alive) return;
          setTyped(m.text.slice(0, c));
          await wait(48);
        }
        await wait(380);
        if (!alive) return;
        setReaders(true);
        await wait(3200);
        if (!alive) return;
        // readers fade, then the next moment is narrated
        setReaders(false);
        setTyped("");
        await wait(420);
        if (!alive) return;
        i++;
        setIdx(i % MOMENTS.length);
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  const m = MOMENTS[idx];

  return (
    <div className="hstage" ref={rootRef} aria-hidden="true">
      {/* you narrate it once */}
      <div className="hstage__compose">
        <span className="hstage__date">{m.date}</span>
        <span className="hstage__colon">:</span>
        <span className="hstage__text">
          {typed}
          {!readers && <span className="caret" />}
        </span>
      </div>

      {/* the log forks to every reader */}
      <svg
        className={`hstage__fork${readers ? " is-on" : ""}`}
        viewBox="0 0 320 52"
        preserveAspectRatio="none"
        fill="none"
      >
        <path d="M160 2 v10 C160 36 80 24 80 50" pathLength={1} />
        <path d="M160 2 v10 C160 36 240 24 240 50" pathLength={1} />
      </svg>

      <div className="hstage__readers">
        <div className={`hstage__card${readers ? " is-in" : ""}`}>
          <div className="hstage__entry">
            <span className="hstage__dot" />
            <div>
              <div className="hstage__edate">{m.date}</div>
              <div className="hstage__etitle">{m.text}</div>
            </div>
          </div>
          <span className="hstage__label">humans read <Who readers={HUMAN_READERS} /></span>
        </div>
        <div className={`hstage__card hstage__card--agent${readers ? " is-in" : ""}`}>
          <pre className="hstage__llm">
            <span className="k">GET</span> /asha/llm.txt{"\n"}
            <span className="hl">{m.date} {m.text.replace(/\.$/, "")}</span>
          </pre>
          <span className="hstage__label">agents ingest <Who readers={AGENT_READERS} /></span>
        </div>
      </div>
    </div>
  );
}
