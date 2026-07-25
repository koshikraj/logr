"use client";

// Visitor-facing "ask" intro — the ProfileTour's final step, repackaged as a
// single popover for people *viewing* a profile (the ?tour=1 spotlight tour
// only ever runs for the freshly onboarded owner). One card on the bar's ask
// pill: what the AI is, live suggestion chips to try, and a "type your own"
// hatch into the chat. Shown once per browser; a browser that already ran the
// owner tour saw this as the tour's finale and is skipped.

import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

const SEEN_KEY = "logr-ask-intro-done";
const TOUR_DONE_KEY = "logr-tour-done"; // ProfileTour's flag — its "ask" step covers this
const PAD = 5;
const CARD_W = 320;
const SHOW_DELAY_MS = 1600; // let the bar settle and the reader land first
const RETRY_MS = 250;
const MAX_TRIES = 20;

type Rect = { x: number; y: number; w: number; h: number };

export function AskIntro({
  name,
  eventCount,
  suggestions,
  onAsk,
  onOpenChat,
  chatOpen,
}: {
  name: string;
  /** size of the log backing the answers — shown as the grounding line */
  eventCount: number;
  /** live suggestion chips (same feed as the launcher pill) */
  suggestions: string[];
  /** open the chat dialog with this question (same path as the bar button) */
  onAsk: (q: string) => void;
  /** open the chat dialog empty — the "ask your own" hatch */
  onOpenChat: () => void;
  /** the visitor found the chat on their own — stand down */
  chatOpen: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [gone, setGone] = useState(false);
  const shownRef = useRef(false);
  const chatOpenRef = useRef(chatOpen);

  useEffect(() => {
    // the owner tour owns this page-load's spotlight — never double up
    if (new URLSearchParams(window.location.search).get("tour") === "1") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector('[data-tour="ask"]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      // the card is about to be visible — THIS is when "seen once" is true
      localStorage.setItem(SEEN_KEY, "1");
      shownRef.current = true;
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };

    const arm = () => {
      if (cancelled) return;
      // checked at fire time (not mount) so a tour that just ran still counts
      if (localStorage.getItem(SEEN_KEY) || localStorage.getItem(TOUR_DONE_KEY)) return;
      if (chatOpenRef.current) {
        // they beat us to the chat — the intro has nothing left to teach
        localStorage.setItem(SEEN_KEY, "1");
        return;
      }
      if (!document.querySelector('[data-tour="ask"]')) {
        if (++tries < MAX_TRIES) timer = setTimeout(arm, RETRY_MS);
        return;
      }
      measure();
    };
    timer = setTimeout(arm, SHOW_DELAY_MS);

    const onMove = () => { if (shownRef.current) measure(); };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { passive: true });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove);
    };
  }, []);

  // shown, then the pill/chat got used directly — the card's job is done
  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen && shownRef.current) setGone(true);
  }, [chatOpen]);

  useEffect(() => {
    if (!rect || gone) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setGone(true); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rect, gone]);

  if (!rect || gone) return null;

  const first = (name.trim().split(/\s+/)[0] || name).toLowerCase();
  const dismiss = () => setGone(true);

  // phones get a roomier card: near full-width with slimmer gutters (type
  // and padding scale up alongside, via the --ask media query)
  const vw = window.innerWidth;
  const phone = vw <= 600;
  const margin = phone ? 12 : 16;
  const cardW = Math.min(phone ? 372 : CARD_W, vw - margin * 2);
  const cardX = Math.max(margin, Math.min(rect.x + rect.w + PAD - cardW, vw - cardW - margin));

  return (
    <>
      <div
        className="tour-spot"
        style={{ left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 }}
        aria-hidden="true"
      />
      <div
        className="tour-card-wrap tour-card-wrap--ask"
        style={{ left: cardX, top: rect.y + rect.h + PAD + 16, width: cardW }}
        role="dialog"
        aria-label={`ask about ${name}`}
      >
        <span className="tour-card__arrow" aria-hidden="true" />
        <div className="tour-card">
          <div className="tour-card__strip" />
          <div className="tour-card__body">
            <div className="tour-card__row">
              <AgentAvatar state="explaining" size={24} entrance className="tour-card__agent" />
              <div className="tour-card__copy">
                <div className="tour-card__title-row">
                  <span className="tour-card__title">meet loggy</span>
                  <span className="ask-intro__badge"><span className="ask-intro__dot" />ai · live</span>
                </div>
                <p className="tour-card__text">
                  {/* seam spaces as explicit strings — the bundled Next's JSX
                      transform trims edge whitespace off multiline text nodes */}
                  Loggy is this page&apos;s AI agent. Ask it anything about {first}
                  {" — "}answers come straight from what&apos;s logged here, nothing invented. Try one:
                </p>
                <span className="tour-chips">
                  {suggestions.slice(0, 3).map((q, i) => (
                    <button
                      key={q}
                      type="button"
                      className="tour-chip"
                      style={{ animationDelay: `${120 + i * 90}ms` }}
                      onClick={() => {
                        dismiss();
                        onAsk(q); // opens the chat with the question, like the bar button
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </span>
                {eventCount > 0 && (
                  <p className="ask-intro__meta">
                    grounded in {eventCount} logged {eventCount === 1 ? "entry" : "entries"}
                  </p>
                )}
              </div>
            </div>
            <div className="tour-card__foot">
              <button
                type="button"
                className="ask-intro__own"
                onClick={() => {
                  dismiss();
                  onOpenChat();
                }}
              >
                ask your own →
              </button>
              <span className="tour-card__btns">
                <button type="button" className="tour-next" onClick={dismiss}>got it ✓</button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
