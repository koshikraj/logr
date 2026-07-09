"use client";
/* These demos drive looping animations from timers; setState inside the
   async loops is intentional. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- STEP 02 — compose: type, attach, send, loop ----------
const COMPOSE_LINES = ["shipped my first app.", "started pottery. terrible at it.", "ran a half marathon."];

export function ComposeDemo() {
  const [typed, setTyped] = useState("");
  const [photos, setPhotos] = useState(0);
  const [saved, setSaved] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) {
      setTyped(COMPOSE_LINES[0]);
      setPhotos(1);
      return;
    }
    if (!inView) return; // paused off-screen
    (async () => {
      let li = 0;
      while (alive) {
        const line = COMPOSE_LINES[li % COMPOSE_LINES.length];
        for (let i = 0; i <= line.length; i++) {
          if (!alive) return;
          setTyped(line.slice(0, i));
          await wait(52);
        }
        await wait(450);
        if (!alive) return;
        setPhotos(li % 2 === 0 ? 2 : 1);
        await wait(850);
        if (!alive) return;
        setSaved(true); // "enter"
        await wait(1300);
        if (!alive) return;
        setSaved(false);
        setPhotos(0);
        setTyped("");
        await wait(600);
        li++;
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  return (
    <div className="pw-compose" ref={rootRef}>
      <div className="pw-compose__line">
        <span className="pw-compose__date">2026.01.02</span>
        <span className="pw-compose__colon">:</span>
        <span className="pw-compose__text">{typed}<span className="pw-compose__caret" /></span>
      </div>
      {photos > 0 && (
        <div className="pw-photos">
          {Array.from({ length: photos }).map((_, i) => <span key={i} className="pw-photo" />)}
        </div>
      )}
      <div className="pw-compose__meta">
        <span>tag · <span className="accent">milestone</span></span>
        <span>{photos} photo{photos === 1 ? "" : "s"}</span>
      </div>
      <div className="pw-compose__hint">
        <span className={saved ? "is-saved" : ""}>{saved ? "saved ·" : <><kbd>⌘</kbd> <kbd>↵</kbd> save</>}</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>
  );
}

// ---------- STEP 03 — the /ask chat, live ----------
const QA = [
  { q: "what has asha been up to?", a: "she just left big tech — and wrote about it." },
  { q: "since when?", a: "the essay went up in july 2026." },
  { q: "does she run?", a: "a half marathon in march. 2:19." },
];

export function AskDemo() {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "answer">("typing");
  const [a, setA] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) { setQ(QA[0].q); setA(QA[0].a); setPhase("answer"); return; }
    if (!inView) return; // paused off-screen
    (async () => {
      let i = 0;
      while (alive) {
        const { q: qq, a: aa } = QA[i % QA.length];
        setPhase("typing"); setA(""); setQ("");
        for (let c = 0; c <= qq.length; c++) { if (!alive) return; setQ(qq.slice(0, c)); await wait(42); }
        await wait(350);
        if (!alive) return; setPhase("thinking"); await wait(1100);
        if (!alive) return; setPhase("answer");
        // stream the answer, like the real grounded chat
        for (let c = 1; c <= aa.length; c += 2) { if (!alive) return; setA(aa.slice(0, c)); await wait(22); }
        setA(aa); await wait(2600);
        i++;
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  return (
    <div className="pw-mini pw-mini--ask" ref={rootRef}>
      <div className="pw-mini__bar"><span className="accent">/</span>asha<span className="accent">/</span>ask</div>
      <div className="pw-mini__body">
        <div className="q">{q}<span className="pw-compose__caret" style={{ opacity: phase === "typing" ? 1 : 0 }} /></div>
        {phase === "thinking" && <div className="pw-dots" aria-label="thinking"><span /><span /><span /></div>}
        {phase === "answer" && <div className="a">{a}</div>}
      </div>
    </div>
  );
}

// ---------- STEP 04 — keep going: entries accumulate, with photos, in a loop ----------
const MOMENTS = [
  { date: "2026.07", title: "left big tech. wrote about it." },
  { date: "2026.08", title: "first 100 readers.", photo: true },
  { date: "2026.09", title: "second pot. less lopsided.", photo: true },
  { date: "2026.11", title: "a quiet tuesday. good bread." },
  { date: "2027.01", title: "a year of logging. still here." },
];

export function GrowDemo() {
  const [count, setCount] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) { setCount(MOMENTS.length); return; }
    if (!inView) return; // paused off-screen
    (async () => {
      while (alive) {
        for (let n = 1; n <= MOMENTS.length; n++) { if (!alive) return; setCount(n); await wait(1500); }
        await wait(1600);
        if (!alive) return; setCount(1); await wait(900);
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  // newest (most recently added) on top
  const shown = MOMENTS.slice(0, count).reverse();
  return (
    <div className="pw-timeline" ref={rootRef}>
      {shown.map((m, i) => (
        <div key={m.date} className={`pw-timeline-entry ${i === 0 ? "pw-timeline-entry--now" : i === 1 ? "pw-timeline-entry--recent" : ""}`}>
          <div className="pw-timeline-entry__date">{m.date}</div>
          <div className="pw-timeline-entry__title">{m.title}</div>
          {m.photo && <span className="pw-photo pw-photo--sm" />}
        </div>
      ))}
      <div className="pw-timeline-more">— a life is never done —</div>
    </div>
  );
}
