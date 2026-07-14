"use client";
/* The maker's note plays like a chat message: typing dots, then the
   sentence streams in word by word. setState in the async loop is intentional. */
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Tok = { text: string; href?: string; hi?: boolean };

const TOKENS: Tok[] = [
  { text: "hi,", hi: true },
  { text: "i'm", hi: true },
  { text: "koshik.", href: "/koshik", hi: true },
  ..."no resume or feed ever held a whole story. so i built logr — log it once, and anyone curious, human or agent, can just ask."
    .split(" ")
    .map((text) => ({ text })),
];

export function HelloNote() {
  const [shown, setShown] = useState(0);
  const [thinking, setThinking] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);
  const started = useRef(false);

  useEffect(() => {
    let alive = true;
    if (reduced()) { setThinking(false); setShown(TOKENS.length); return; }
    if (!inView || started.current) return;
    started.current = true; // plays once; a note, not a loop
    (async () => {
      await wait(700);
      if (!alive) return;
      setThinking(false);
      for (let n = 1; n <= TOKENS.length; n++) {
        if (!alive) return;
        setShown(n);
        await wait(42);
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  const streaming = !thinking && shown < TOKENS.length;

  return (
    <div className="hello__msg" ref={rootRef}>
      <span className="hello__label">koshik <span className="accent">·</span> now</span>
      <div className="hello__bubble">
        {thinking ? (
          <div className="pw-dots" aria-label="typing"><span /><span /><span /></div>
        ) : (
          <p className="hello__copy">
            {TOKENS.slice(0, shown).map((t, i) => {
              const word = t.href ? (
                <Link key={i} href={t.href}>{t.text}</Link>
              ) : t.hi ? (
                <span key={i} className="hi">{t.text}</span>
              ) : (
                <span key={i}>{t.text}</span>
              );
              return <span key={i} className="hello__word">{word}{" "}</span>;
            })}
            {streaming && <span className="hello__caret" aria-hidden="true" />}
          </p>
        )}
      </div>
    </div>
  );
}
