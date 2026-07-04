"use client";

import { useEffect, useState, type RefObject } from "react";

/** True while the element is (roughly) on screen. Used to pause the landing
 *  page's looping demos when they're scrolled away — no timers, no state
 *  churn, no battery drain for pixels nobody sees. */
export function useInView<T extends HTMLElement>(ref: RefObject<T | null>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}
