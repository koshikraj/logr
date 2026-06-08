"use client";

import { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Portfolio from "@/components/Portfolio";
import { Mark } from "@/components/Mark";
import { Button } from "@/components/ui/Button";
import { LAYOUTS, PALETTES } from "@/lib/theme";
import {
  narrateEventsAction,
  createProfileAction,
  insertEventsAction,
  updateThemeAction,
  checkHandleAction,
  type ReviewEvent,
} from "@/lib/actions";
import type { ProfileDTO, MediaItem } from "@/lib/profile";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const disp = (iso: string, full: boolean) => {
  const [y, mo, d] = iso.split("-").map(Number);
  return full ? `${M[mo - 1]} ${d}, ${y}` : `${M[mo - 1]} ${y}`;
};

type HandleState = "" | "checking" | "ok" | "taken" | "invalid";

const LAYOUT_SVGS: Record<string, React.ReactElement> = {
  timeline: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <line x1="14" y1="6" x2="14" y2="52" />
      <circle cx="14" cy="14" r="2.5" fill="currentColor" />
      <circle cx="14" cy="30" r="2" fill="currentColor" />
      <circle cx="14" cy="44" r="1.5" fill="currentColor" />
      <line x1="22" y1="14" x2="100" y2="14" />
      <line x1="22" y1="18" x2="80" y2="18" opacity="0.4" />
      <line x1="22" y1="30" x2="92" y2="30" />
      <line x1="22" y1="34" x2="72" y2="34" opacity="0.4" />
      <line x1="22" y1="44" x2="86" y2="44" />
    </svg>
  ),
  journal: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <line x1="8" y1="12" x2="32" y2="12" />
      <line x1="38" y1="12" x2="108" y2="12" />
      <line x1="38" y1="17" x2="98" y2="17" opacity="0.5" />
      <line x1="8" y1="28" x2="32" y2="28" />
      <line x1="38" y1="28" x2="104" y2="28" />
      <line x1="38" y1="33" x2="90" y2="33" opacity="0.5" />
      <line x1="8" y1="44" x2="32" y2="44" />
      <line x1="38" y1="44" x2="100" y2="44" />
      <line x1="38" y1="49" x2="86" y2="49" opacity="0.5" />
    </svg>
  ),
  magazine: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <rect x="8" y="6" width="60" height="22" fill="currentColor" stroke="none" opacity="0.85" />
      <line x1="72" y1="10" x2="108" y2="10" />
      <line x1="72" y1="15" x2="104" y2="15" opacity="0.5" />
      <line x1="72" y1="20" x2="100" y2="20" opacity="0.5" />
      <line x1="8" y1="36" x2="108" y2="36" strokeWidth="1.2" />
      <line x1="8" y1="42" x2="92" y2="42" />
      <line x1="8" y1="47" x2="80" y2="47" opacity="0.5" />
      <line x1="8" y1="52" x2="86" y2="52" opacity="0.5" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <rect x="6" y="6" width="108" height="46" strokeDasharray="1.5 1.5" />
      <text x="12" y="18" fontFamily="monospace" fontSize="6" fill="currentColor">&gt; logr</text>
      <text x="12" y="28" fontFamily="monospace" fontSize="5" fill="currentColor" opacity="0.7">2026.05 milestone</text>
      <text x="12" y="38" fontFamily="monospace" fontSize="5" fill="currentColor" opacity="0.5">2023.04 win</text>
      <text x="12" y="47" fontFamily="monospace" fontSize="5" fill="currentColor" opacity="0.4">2019.--- founded</text>
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <line x1="8" y1="10" x2="108" y2="10" />
      <line x1="8" y1="14" x2="88" y2="14" opacity="0.4" />
      <line x1="8" y1="23" x2="108" y2="23" />
      <line x1="8" y1="27" x2="78" y2="27" opacity="0.4" />
      <line x1="8" y1="36" x2="102" y2="36" />
      <line x1="8" y1="40" x2="82" y2="40" opacity="0.4" />
      <line x1="8" y1="49" x2="95" y2="49" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <rect x="8" y="8" width="48" height="42" />
      <line x1="16" y1="20" x2="46" y2="20" />
      <line x1="16" y1="25" x2="40" y2="25" opacity="0.5" />
      <line x1="16" y1="30" x2="44" y2="30" opacity="0.4" />
      <rect x="64" y="8" width="48" height="42" />
      <line x1="72" y1="20" x2="102" y2="20" />
      <line x1="72" y1="25" x2="96" y2="25" opacity="0.5" />
      <line x1="72" y1="30" x2="100" y2="30" opacity="0.4" />
    </svg>
  ),
  centered: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <line x1="60" y1="4" x2="60" y2="54" strokeWidth="0.5" />
      <line x1="16" y1="14" x2="54" y2="14" />
      <line x1="18" y1="18" x2="52" y2="18" opacity="0.4" />
      <circle cx="60" cy="14" r="2" fill="currentColor" />
      <line x1="66" y1="28" x2="104" y2="28" />
      <line x1="68" y1="32" x2="104" y2="32" opacity="0.4" />
      <circle cx="60" cy="28" r="2" fill="currentColor" />
      <line x1="16" y1="44" x2="54" y2="44" />
      <line x1="20" y1="48" x2="52" y2="48" opacity="0.4" />
      <circle cx="60" cy="44" r="2" fill="currentColor" />
    </svg>
  ),
  polaroid: (
    <svg viewBox="0 0 120 58" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <rect x="8" y="6" width="26" height="26" fill="currentColor" stroke="none" opacity="0.15" />
      <rect x="8" y="6" width="26" height="26" />
      <line x1="8" y1="38" x2="34" y2="38" opacity="0.6" />
      <line x1="10" y1="42" x2="30" y2="42" opacity="0.4" />
      <rect x="47" y="12" width="26" height="26" fill="currentColor" stroke="none" opacity="0.15" />
      <rect x="47" y="12" width="26" height="26" />
      <line x1="47" y1="44" x2="73" y2="44" opacity="0.6" />
      <rect x="86" y="8" width="26" height="26" fill="currentColor" stroke="none" opacity="0.15" />
      <rect x="86" y="8" width="26" height="26" />
      <line x1="86" y1="40" x2="112" y2="40" opacity="0.6" />
    </svg>
  ),
};

export function Onboarding({ name: initialName, image, suggestedHandle }: { name: string; image: string; suggestedHandle: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState(suggestedHandle);
  const [bio, setBio] = useState("");
  const [story, setStory] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [palette, setPalette] = useState("paper");
  const [layout, setLayout] = useState("timeline");
  const [hstate, setHState] = useState<HandleState>("");
  const [herror, setHError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, startPublish] = useTransition();

  // stepper
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "bck">("fwd");
  const publishBtnRef = useRef<HTMLButtonElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const [timelineTop, setTimelineTop] = useState(280);

  useEffect(() => {
    const measure = () => {
      const frame = previewFrameRef.current;
      if (!frame) return;
      const tl = frame.querySelector<HTMLElement>(".timeline");
      if (!tl) return;
      setTimelineTop(tl.getBoundingClientRect().top - frame.getBoundingClientRect().top);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (previewFrameRef.current) ro.observe(previewFrameRef.current);
    return () => ro.disconnect();
  }, [events]);

  const goTo = useCallback((n: number) => {
    setDir(n >= step ? "fwd" : "bck");
    setStep(n);
  }, [step]);

  const nextStep = useCallback(() => goTo(Math.min(step + 1, 2)), [goTo, step]);
  const prevStep = useCallback(() => goTo(Math.max(step - 1, 0)), [goTo, step]);

  // handle availability debounce
  useEffect(() => {
    const h = handle.trim().toLowerCase();
    const t = setTimeout(async () => {
      if (!h) { setHState(""); return; }
      setHState("checking");
      try {
        const r = await checkHandleAction(h);
        setHState(r.available ? "ok" : r.error === "taken" ? "taken" : "invalid");
        setHError(r.available ? null : r.error ?? null);
      } catch {
        setHState("invalid");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [handle]);

  const lastNarratedRef = useRef("");

  async function narrate() {
    const text = story.trim();
    if (!text || reading || text === lastNarratedRef.current) return;
    setReading(true);
    setError(null);
    try {
      const evs = await narrateEventsAction(story);
      lastNarratedRef.current = text;
      setEvents(evs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that.");
    } finally {
      setReading(false);
    }
  }

  // Keep a stable ref to narrate so the debounce timer always calls the latest closure
  const narrateRef = useRef(narrate);
  useEffect(() => { narrateRef.current = narrate; });

  // Auto-narrate: 2 s after the user stops typing, once they've written 3+ words
  useEffect(() => {
    if (wordCount < 3 || reading) return;
    const t = setTimeout(() => narrateRef.current(), 2000);
    return () => clearTimeout(t);
  }, [wordCount, reading]);

  function publish() {
    setError(null);
    startPublish(async () => {
      const res = await createProfileAction({ handle, name, bio, avatarUrl: image || null });
      if (!res.ok) { setError(res.error); return; }
      if (events.length) await insertEventsAction(events);
      await updateThemeAction({ palette, layout, accentOverride: null });
      router.push(`/${res.username}`);
    });
  }

  const preview: ProfileDTO = useMemo(() => ({
    id: "preview",
    username: handle || "you",
    name: name || "Your name",
    handle: `@${handle || "you"}`,
    bio: bio || "a line about you.",
    status: "",
    location: "",
    about: null,
    avatarUrl: image || null,
    socials: [],
    theme: { palette, layout, accentOverride: null },
    activeOrbit: null,
    dsaMetrics: null,
    sysArchitecture: null,
    events: events.map((e, i) => ({
      id: `p${i}`,
      dateOn: e.dateOn,
      date: disp(e.dateOn, e.fullDate),
      year: Number(e.dateOn.slice(0, 4)),
      title: e.title,
      tags: e.tags,
      featured: e.featured,
      fullDate: e.fullDate,
      body: e.body,
      icon: null,
      link: null,
      media: e.media as MediaItem[],
    })),
  }), [handle, name, bio, image, palette, layout, events]);

  const canGoNext0 = hstate === "ok" && !!name.trim();
  const canPublish = hstate === "ok" && !!name.trim() && !publishing;

  return (
    <div className="onb">

      {/* ---- publish loading overlay ---- */}
      {publishing && (
        <div className="onb__pub-overlay" role="status" aria-live="polite">
          <div className="onb__pub-descent" aria-hidden="true">
            <span className="onb__pd-dd onb__pd-dd--1" />
            <span className="onb__pd-row onb__pd-row--1">
              <span className="onb__pd-sk onb__pd-sk--date" />
              <span className="onb__pd-sk onb__pd-sk--title" />
              <span className="onb__pd-sk onb__pd-sk--line onb__pd-sk--line-a" />
              <span className="onb__pd-sk onb__pd-sk--line onb__pd-sk--line-b" />
            </span>
            <span className="onb__pd-dd onb__pd-dd--2" />
            <span className="onb__pd-row onb__pd-row--2">
              <span className="onb__pd-sk onb__pd-sk--date" />
              <span className="onb__pd-sk onb__pd-sk--title" />
              <span className="onb__pd-sk onb__pd-sk--line onb__pd-sk--line-a" />
              <span className="onb__pd-sk onb__pd-sk--line onb__pd-sk--line-b" />
              <span className="onb__pd-sk onb__pd-sk--line onb__pd-sk--line-c" />
            </span>
            <span className="onb__pd-dd onb__pd-dd--3" />
            <span className="onb__pd-row onb__pd-row--3">
              <span className="onb__pd-sk onb__pd-sk--date" />
              <span className="onb__pd-sk onb__pd-sk--title" />
              <span className="onb__pd-sk onb__pd-sk--line onb__pd-sk--line-a" />
            </span>
            <span className="onb__pd-label">events incoming</span>
          </div>
          <p className="onb__pub-msg">your page is getting ready.</p>
          <span className="onb__pub-handle">logr.life/<span>{handle}</span></span>
        </div>
      )}

      {/* ---- top bar ---- */}
      <header className="onb__topbar">
        <div className="onb__topbar__inner">
          <div className="onb__brand"><Mark />logr</div>
          <nav className="onb__steprail" aria-label="onboarding steps">
            {([["01", "you"], ["02", "story"], ["03", "look"]] as const).map(([num, label], i) => (
              <button
                key={i}
                type="button"
                aria-current={step === i ? true : undefined}
                data-done={step > i ? true : undefined}
                onClick={() => goTo(i)}
              >
                <span className="onb__steprail__n">{num}</span>
                {label}
              </button>
            ))}
            <span className="onb__steprail__sep" aria-hidden="true" />
            <button type="button" className="onb__steprail__publish" onClick={() => publishBtnRef.current?.focus()}>publish</button>
          </nav>
          <div className="onb__topbar__util">
            <span className="onb__saving">
              <span className="onb__saving__dot" aria-hidden="true" />
              draft saved
            </span>
          </div>
        </div>
      </header>

      {/* ---- main shell ---- */}
      <div className="onb__shell">

        {/* LEFT: FORM + NAV */}
        <div className="onb__left">
        <section className="onb__form" aria-label="build your logr">
          <div key={step} className={`onb__step-content onb__step-content--${dir}`}>

            {/* ── step 0: you ── */}
            {step === 0 && (
              <div className="onb__fsec">
                <div className="onb__fsec__head">
                  <h2 className="onb__fsec__title">
                    <span className="onb__fsec__num"><span className="onb__ac">01</span></span>
                    you
                  </h2>
                </div>

                <div className="onb__you">
                  <span className="onb__avatar-wrap">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" />
                    ) : (
                      <span className="onb__avatar-letter">{(name || "·").charAt(0).toLowerCase()}</span>
                    )}
                  </span>

                  <input
                    className="onb__box-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="your name"
                    autoFocus
                  />

                  <div className="onb__handle-row">
                    <span className="onb__handle-prefix">logr.life<span className="onb__slash">/</span></span>
                    <input
                      className="onb__handle-input"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.toLowerCase())}
                      placeholder="handle"
                    />
                    <span className={`onb__field__status onb__handle-status onb__field__status--${hstate}`}>
                      {hstate === "checking" ? (
                        <><span className="onb__field__status__dot" /> checking…</>
                      ) : hstate === "ok" ? (
                        <><span className="onb__field__status__dot" /> available</>
                      ) : hstate === "taken" ? "taken" : herror ?? ""}
                    </span>
                  </div>

                  <textarea
                    className="onb__bio__field"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="one line about you"
                  />
                </div>
              </div>
            )}

            {/* ── step 1: story ── */}
            {step === 1 && (
              <div className="onb__fsec">
                <div className="onb__fsec__head">
                  <h2 className="onb__fsec__title">
                    <span className="onb__fsec__num"><span className="onb__ac">02</span></span>
                    story
                  </h2>
                  <span className="onb__fsec__badge">type it like a friend asked — we&apos;ll find the dates</span>
                </div>

                <textarea
                  className="onb__story__field"
                  rows={6}
                  value={story}
                  onChange={(e) => {
                    setStory(e.target.value);
                    setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length);
                  }}
                  placeholder="Founded Consenso Labs in 2019. Won the AA hackathon in April 2023 with ZenGuard. Launched brewit in April 2025…"
                  autoFocus
                />

                {reading && (
                  <div className="onb__dots-loader" aria-hidden="true">
                    <span className="onb__dots"><span /><span /><span /></span>
                    <span className="onb__dots-label">thinking it over</span>
                  </div>
                )}

                <div className="onb__story__readout">
                  {events.length > 0 ? (
                    <span className="onb__story__readout__count">
                      <strong>{events.length}</strong> event{events.length > 1 ? "s" : ""} drafted
                    </span>
                  ) : null}
                  <span className="onb__dim">{wordCount > 0 ? `${wordCount} words` : "write your story above"}</span>
                </div>

                <div className="onb__story__actions">
                  <button type="button" className="onb__story__btn" onClick={narrate} disabled={reading || !story.trim()}>
                    {reading ? "reading…" : wordCount >= 3 ? "build now →" : "build my timeline →"}
                  </button>
                </div>

                {error && <p className="onb__error">{error}</p>}

                {events.length > 0 && (
                  <div className="onb__chips">
                    {events.slice(0, 6).map((e, i) => (
                      <span key={i} className="onb__chip">
                        <span className="onb__chip__year">{e.dateOn.slice(0, 4)}</span>
                        <span>{e.title.length > 32 ? e.title.slice(0, 32) + "…" : e.title}</span>
                      </span>
                    ))}
                    {events.length > 6 && (
                      <span className="onb__chip onb__chip--more">+{events.length - 6} more</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── step 2: look ── */}
            {step === 2 && (
              <div className="onb__fsec">
                <div className="onb__fsec__head">
                  <h2 className="onb__fsec__title">
                    <span className="onb__fsec__num"><span className="onb__ac">03</span></span>
                    look
                  </h2>
                </div>

                <div className="onb__look">
                  <div>
                    <div className="onb__look__subhead">layout</div>
                    <div className="onb__layouts">
                      {Object.entries(LAYOUTS).map(([k, l]) => (
                        <button key={k} type="button" className="onb__layout-card" aria-pressed={layout === k} onClick={() => setLayout(k)}>
                          {LAYOUT_SVGS[k] ?? LAYOUT_SVGS.timeline}
                          <div>
                            <div className="onb__layout-card__name">{l.name}</div>
                            <div className="onb__layout-card__note">{l.note}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="onb__look__subhead">palette</div>
                    <div className="onb__palettes">
                      {Object.entries(PALETTES).map(([k, p]) => (
                        <button key={k} type="button" className="onb__palette-card" aria-pressed={palette === k} onClick={() => setPalette(k)}>
                          <span className="onb__palette-card__swatch" style={{ background: p.paper }}>
                            <span className="onb__swatch__ink" style={{ background: p.ink }} />
                            <span className="onb__swatch__acc" style={{ background: p.accent }} />
                          </span>
                          <span>
                            <span className="onb__palette-card__name">{p.name}</span>
                            <br />
                            <span className="onb__palette-card__note">{p.note}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* NAV BAR — bottom of left column */}
        <footer className="onb__actionbar">
          <div className="onb__actionbar__left">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={prevStep}>← back</Button>
            )}
          </div>

          <div className="onb__actionbar__right">
            <span className="onb__step-ind">{step + 1} / 3</span>

            {step < 2 ? (
              <Button
                variant="primary"
                size="lg"
                onClick={nextStep}
                disabled={step === 0 && !canGoNext0}
              >
                next →
              </Button>
            ) : (
              <Button
                ref={publishBtnRef}
                variant="accent"
                size="lg"
                onClick={publish}
                disabled={!canPublish}
              >
                {publishing ? "publishing…" : "publish & go live →"}
              </Button>
            )}
          </div>
        </footer>
        </div>{/* end .onb__left */}

        <div className="onb__shell__divider" aria-hidden="true" />

        {/* RIGHT: LIVE PREVIEW — full height, no nav bar */}
        <aside className="onb__preview" aria-label="live preview">
          <div className="onb__preview__head">
            <span>logr.life/{handle || "you"}</span>
            <span className="onb__live">
              <span className="onb__live__dot" aria-hidden="true" />
              LIVE
            </span>
          </div>
          <div className="onb__preview__frame" ref={previewFrameRef}>
            <Portfolio profile={preview} chatEnabled={false} />
            {reading && (
              <div
                className="onb__preview__sk"
                aria-hidden="true"
                style={{ background: `linear-gradient(to bottom, transparent ${timelineTop - 20}px, var(--paper) ${timelineTop + 4}px)` }}
              >
                <div className="onb__preview__sk__page" style={{ paddingTop: timelineTop + 4 }}>
                  <div className="onb__preview__sk__tl">
                    {[
                      { title: "78%", b1: "92%", b2: "60%", accent: true },
                      { title: "64%", b1: "84%", b2: undefined, accent: false },
                      { title: "54%", b1: undefined,  b2: undefined, accent: false },
                    ].map((e, i) => (
                      <div key={i} className="onb__sk-entry">
                        <span className={`onb__sk-entry__dot${e.accent ? "" : " onb__sk-entry__dot--ink"}`} />
                        <span className="onb__sk onb__sk-entry__date" style={{ width: "38%" }} />
                        <span className="onb__sk onb__sk-entry__title" style={{ width: e.title }} />
                        {e.b1 && <span className="onb__sk onb__sk-entry__b1" style={{ width: e.b1 }} />}
                        {e.b2 && <span className="onb__sk onb__sk-entry__b2" style={{ width: e.b2 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

      </div>

    </div>
  );
}
