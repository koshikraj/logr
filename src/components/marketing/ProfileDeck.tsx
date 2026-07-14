"use client";
/* The "for anyone" scene from the launch promo: a role word rotates while a
   warm highlight sweeps across real profile cards. The interval drives
   setState by design. */
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInView } from "./useInView";

export type FeaturedProfile = {
  username: string;
  name: string;
  role?: string; // card label: "community", "celebrity", … (curated cards only)
  word?: string; // headline word: "communities.", … (absent on auto-filled extras)
  avatarUrl: string | null;
  events: number;
};

const HOLD_MS = 2600;

export function ProfileDeck({ profiles }: { profiles: FeaturedProfile[] }) {
  // Curated profiles (the ones with a headline word) must come first in
  // `profiles` — slot i highlights card i. Auto-filled extras follow: they get
  // no rotation slot and only light up on the closing "anyone." beat.
  const wordCount = profiles.filter((p) => p.word).length;
  const slots = wordCount + 1;
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(wordCount); // settle on "anyone." — all cards lit
      return;
    }
    if (!inView) return; // paused off-screen
    const id = setInterval(() => setActive((a) => (a + 1) % slots), HOLD_MS);
    return () => clearInterval(id);
  }, [inView, slots, wordCount]);

  const anyone = active === wordCount;
  const leaving = (active + slots - 1) % slots;
  const words = [...profiles.flatMap((p) => (p.word ? [p.word] : [])), "anyone."];

  return (
    <div className="deck" ref={rootRef}>
      <div className="deck__lead">
        <h2 className="deck__head">
          for
          <span className="deck__words">
            {words.map((w, i) => (
              <span
                key={w}
                className={`deck__word${i === active ? " is-on" : ""}${i === leaving ? " is-off" : ""}${i === words.length - 1 ? " deck__word--anyone" : ""}`}
              >
                {w}
              </span>
            ))}
          </span>
        </h2>
        <p className="deck__sub">real logs, live now — tap one.</p>
        <Link className="deck__more" href="/explore">
          explore everyone →
        </Link>
      </div>
      <div className="deck__grid">
        {profiles.map((p, i) => (
          <Link
            key={p.username}
            href={`/${p.username}`}
            className={`person${i === active || anyone ? " is-hot" : ""}`}
            aria-label={`${p.name}'s logr`}
          >
            <span className="person__photo" aria-hidden="true">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" loading="lazy" />
              ) : (
                <span className="person__initial">{p.name.charAt(0).toLowerCase()}</span>
              )}
            </span>
            <span className="person__copy">
              <span className="person__name">{p.name.toLowerCase()}</span>
              <span className="person__handle">
                logr.it<span className="accent">/</span>
                {p.username}
              </span>
              <span className="person__meta">
                · {p.role ? `${p.role} · ` : ""}
                {p.events} events
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
