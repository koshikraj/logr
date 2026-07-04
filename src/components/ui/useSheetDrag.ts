"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Swipe-down-to-dismiss for bottom-sheet dialogs on phones.
 *
 *  Attaches touch handlers to the sheet card: a downward drag that begins
 *  while the card's inner scrollers are at the top follows the finger;
 *  releasing past ~25% of the card height (or a quick downward flick)
 *  dismisses, anything less springs back. Upward gestures and drags that
 *  start mid-scroll are left alone so scrolling inside the sheet still
 *  works. No-op on desktop widths and mouse input. */
export function useSheetDrag(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const card = ref.current;
    if (!card || !active) return;

    let startY = 0, lastY = 0, lastT = 0, vel = 0, dy = 0;
    let tracking = false, engaged = false;

    // true when nothing between the touch target and the card is scrolled down
    const scrollersAtTop = (from: EventTarget | null): boolean => {
      let n = from instanceof Element ? from : null;
      while (n && n !== card) {
        if (n.scrollTop > 0) return false;
        n = n.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 600px)").matches) return;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      vel = 0; dy = 0; engaged = false;
      tracking = scrollersAtTop(e.target);
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      vel = (y - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = y; lastT = e.timeStamp;
      dy = y - startY;
      if (!engaged) {
        if (dy > 10) { engaged = true; card.style.transition = "none"; }
        else if (dy < -10) { tracking = false; return; } // upward — it's a scroll
        else return;
      }
      e.preventDefault(); // the sheet owns this gesture now
      card.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };

    const settle = () => {
      if (!engaged) { tracking = false; return; }
      tracking = false; engaged = false;
      const h = card.getBoundingClientRect().height;
      if (dy > h * 0.25 || vel > 0.55) {
        card.style.transition = "transform 200ms ease-in";
        card.style.transform = "translateY(105%)";
        setTimeout(() => closeRef.current(), 180);
      } else {
        card.style.transition = "transform 260ms cubic-bezier(0.32, 0.72, 0.28, 1)";
        card.style.transform = "";
      }
    };

    card.addEventListener("touchstart", onStart, { passive: true });
    card.addEventListener("touchmove", onMove, { passive: false });
    card.addEventListener("touchend", settle);
    card.addEventListener("touchcancel", settle);
    return () => {
      card.removeEventListener("touchstart", onStart);
      card.removeEventListener("touchmove", onMove);
      card.removeEventListener("touchend", settle);
      card.removeEventListener("touchcancel", settle);
    };
  }, [ref, active]);
}
