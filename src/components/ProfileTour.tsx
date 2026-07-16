"use client";

// First-run product tour (design: Logr Profile Tour.dc.html): a spotlight
// steps through the top-bar controls — ask → dashboard → share — with a
// mascot popover. Armed only by ?tour=1 (appended when onboarding opens the
// page) and shown once per browser: the localStorage flag is written the
// moment the tour first RENDERS (not when armed), so a cancelled mount can't
// burn the one showing.

import { useEffect, useRef, useState } from "react";

const TOUR_DONE_KEY = "logr-tour-done";
const PAD = 5;
const CARD_W = 300;
const ARM_RETRY_MS = 250;
const ARM_MAX_TRIES = 20;

type Step = { key: string; title: string; body: string };

// "ask" is deliberately last — its card carries live suggestion chips, and
// trying one hands the user straight into the chat as the tour's finale.
const STEPS: Step[] = [
  {
    key: "dashboard",
    title: "your dashboard",
    body: "Add events, re-sync your sources, and edit anything on this page. Only you can see it.",
  },
  {
    key: "share",
    title: "share your page",
    body: "Grab your logr.it link or a card image to post. This page is the thing you share instead of a resume.",
  },
  {
    key: "ask",
    title: "ask me anything",
    body: "Visitors — and their AIs — can ask questions about you here. Answers come only from what's in your log. Try one:",
  },
];

type Rect = { x: number; y: number; w: number; h: number };

// Survives React StrictMode's dev unmount/remount cycle: the ?tour=1 param is
// consumed (stripped from the URL) by whichever effect run sees it first, so
// the intent has to live outside the component instance.
let tourPending = false;

export function ProfileTour({
  suggestions = [],
  onAsk,
}: {
  /** live "ask" suggestion chips shown on the final step */
  suggestions?: string[];
  /** open the chat dialog with this question (same path as the bar button) */
  onAsk?: (q: string) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const stepIdxRef = useRef(0);
  const stepsRef = useRef<Step[]>([]);
  const measureRef = useRef<() => void>(() => {});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      // strip ?tour=1 so refresh/share never re-arms it
      params.delete("tour");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
      if (!localStorage.getItem(TOUR_DONE_KEY)) tourPending = true;
    }
    if (!tourPending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const measure = () => {
      if (cancelled) return;
      const s = stepsRef.current[stepIdxRef.current];
      const el = s && document.querySelector(`[data-tour="${s.key}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      // the tour is about to be visible — THIS is when "seen once" is true
      localStorage.setItem(TOUR_DONE_KEY, "1");
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measureRef.current = measure;

    // Arm once the bar's targets exist — retries cover slow hydration and
    // this effect racing the rest of the page.
    let tries = 0;
    const arm = () => {
      if (cancelled || !tourPending) return;
      const present = STEPS.filter((s) => document.querySelector(`[data-tour="${s.key}"]`));
      if (!present.length) {
        if (++tries < ARM_MAX_TRIES) timer = setTimeout(arm, ARM_RETRY_MS);
        return;
      }
      stepsRef.current = present;
      stepIdxRef.current = 0;
      setSteps(present);
      setStep(0);
      measure();
    };
    timer = setTimeout(arm, 350); // let the bar settle/animate in

    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { passive: true });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove);
    };
  }, []);

  if (!steps.length || !rect) return null;
  const current = steps[step];
  if (!current) return null;

  const finish = () => {
    tourPending = false;
    localStorage.setItem(TOUR_DONE_KEY, "1");
    setSteps([]);
  };
  const next = () => {
    if (step >= steps.length - 1) {
      finish();
      return;
    }
    stepIdxRef.current = step + 1;
    setStep(step + 1);
    measureRef.current();
  };

  const vw = window.innerWidth;
  const cardX = Math.max(16, Math.min(rect.x + rect.w + PAD - CARD_W, vw - CARD_W - 16));

  return (
    <>
      <div
        className="tour-spot"
        style={{ left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 }}
        aria-hidden="true"
      />
      <div className="tour-card-wrap" style={{ left: cardX, top: rect.y + rect.h + PAD + 16 }} role="dialog" aria-label="page tour">
        <span className="tour-card__arrow" aria-hidden="true" />
        <div className="tour-card" key={current.key}>
          <div className="tour-card__strip" />
          <div className="tour-card__body">
            <div className="tour-card__row">
              <span className="tour-mascot" aria-hidden="true">
                <span className="tour-mascot__head">
                  <span className="tour-mascot__eyes"><span /><span /></span>
                </span>
                <span className="tour-mascot__dot" />
              </span>
              <div className="tour-card__copy">
                <div className="tour-card__title-row">
                  <span className="tour-card__title">{current.title}</span>
                  <span className="tour-card__count">{step + 1} / {steps.length}</span>
                </div>
                <p className="tour-card__text">{current.body}</p>
                {current.key === "ask" && onAsk && suggestions.length > 0 && (
                  <span className="tour-chips">
                    {suggestions.slice(0, 3).map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="tour-chip"
                        onClick={() => {
                          finish();
                          onAsk(q); // opens the chat with the question, like the bar button
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            </div>
            <div className="tour-card__foot">
              <span className="tour-dots">
                {steps.map((s, i) => (
                  <span
                    key={s.key}
                    className={`tour-dot${i === step ? " tour-dot--now" : i < step ? " tour-dot--past" : ""}`}
                  />
                ))}
              </span>
              <span className="tour-card__btns">
                <button type="button" className="tour-skip" onClick={finish}>skip</button>
                <button type="button" className="tour-next" onClick={next}>
                  {step === steps.length - 1 ? "done ✓" : "next →"}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
