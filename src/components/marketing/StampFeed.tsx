"use client";
/* The "log anything" scene from the launch promo: a rail grows, then entries
   stamp onto it one by one — dot pops, text settles in from the right.
   setState inside the async loop is intentional. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ENTRIES = [
  { date: "2026.01", tag: "work", title: "shipped my first app.", icon: "/icons/app-launch.svg" },
  { date: "2026.03", tag: "milestone", title: "ran a half marathon.", icon: "/icons/marathon.svg", link: "strava route" },
  { date: "2026.05", tag: "side quest", title: "started pottery. terrible at it.", icon: "/icons/pottery.svg", link: "studio pics" },
  { date: "2026.07", tag: "writing", title: "wrote about leaving big tech.", icon: "/icons/essay-exit.svg", link: "essay" },
];

export function StampFeed() {
  const [count, setCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    let alive = true;
    if (reduced()) { setCount(ENTRIES.length); return; }
    if (!inView) return; // paused off-screen
    (async () => {
      while (alive) {
        setCount(0);
        await wait(600);
        for (let n = 1; n <= ENTRIES.length; n++) {
          if (!alive) return;
          setCount(n);
          await wait(950);
        }
        await wait(3200);
      }
    })();
    return () => { alive = false; };
  }, [inView]);

  return (
    <div className="stamp" ref={rootRef}>
      <span className={`stamp__rail${count > 0 ? " is-on" : ""}`} aria-hidden="true" />
      {ENTRIES.map((e, i) => (
        <div
          key={e.date}
          className={`stamp__entry${i < count ? " is-in" : ""}${i === ENTRIES.length - 1 ? " stamp__entry--now" : ""}`}
        >
          <span className="stamp__dot" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="stamp__icon" src={e.icon} alt="" width="40" height="40" />
          <div className="stamp__text">
            <div className="stamp__date">
              {e.date} <span className="stamp__tag">· {e.tag}</span>
            </div>
            <div className="stamp__title">{e.title}</div>
            {e.link && <div className="stamp__link">→ {e.link}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
