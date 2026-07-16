"use client";

// Onboarding v2 (design: Logr Onboarding v2.dc.html) — centered card flow:
//   01 you → 02 sources → building (agentic loader).
// "build my page" creates the profile, hands sources to /api/import, and
// stays on the building screen: extracted events pop into a timeline as
// sources complete (tap one to leave it out), a terminal narrates the agent's
// progress, and "open logr.it/handle →" appears when the page is ready.

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/Mark";
import {
  narrateEventsAction,
  createProfileAction,
  insertEventsAction,
  checkHandleAction,
  getImportJobAction,
  removeImportedEventsAction,
  type ReviewEvent,
  type ImportJobView,
} from "@/lib/actions";
import { SourcesInput, type ImportFile } from "./SourcesInput";

type HandleState = "" | "checking" | "ok" | "taken" | "invalid";
type Screen = "you" | "sources" | "building";

const M = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthYear = (iso: string) => `${M[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const evKey = (e: ReviewEvent) => `${e.dateOn}|${e.title}`;
const viaOf = (e: ReviewEvent) => {
  if (!e.sourceUrl) return "resume";
  try {
    return new URL(e.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
};

const POLL_MS = 1200;
const SLOTS = 6;

function AgentMascot() {
  return (
    <span className="onb2-mascot" aria-hidden="true">
      <span className="onb2-mascot__ring" />
      <span className="onb2-mascot__mark">
        <span className="onb2-mascot__head">
          <span className="onb2-mascot__eyes"><span /><span /></span>
        </span>
        <span className="onb2-mascot__dot" />
      </span>
    </span>
  );
}

export function Onboarding({
  name: initialName,
  image,
  suggestedHandle,
  linkedinEnabled = false,
}: {
  name: string;
  image: string;
  suggestedHandle: string;
  linkedinEnabled?: boolean;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("you");
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState(suggestedHandle);
  const [bio, setBio] = useState("");
  const [hstate, setHState] = useState<HandleState>("");
  const [herror, setHError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // manual "or just type your story" fallback
  const [storyOpen, setStoryOpen] = useState(false);
  const [story, setStory] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [reading, setReading] = useState(false);

  // sources collected by SourcesInput
  const pendingRef = useRef<{ urls: string[]; files: ImportFile[] }>({ urls: [], files: [] });
  const [pendingCount, setPendingCount] = useState(0);
  const onSourcesChange = useCallback((urls: string[], files: ImportFile[]) => {
    pendingRef.current = { urls, files };
    setPendingCount(urls.length + files.length);
  }, []);

  // building screen state
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [fin, setFin] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState(false);
  const chipStatusRef = useRef<Map<string, string>>(new Map());
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameRef = useRef("");

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => [...prev, line].slice(-5));
  }, []);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

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
  const narrateRef = useRef(narrate);
  useEffect(() => { narrateRef.current = narrate; });
  useEffect(() => {
    if (wordCount < 3 || reading) return;
    const t = setTimeout(() => narrateRef.current(), 2000);
    return () => clearTimeout(t);
  }, [wordCount, reading]);

  // ---- building: poll the job and narrate chip-status transitions ----
  const poll = useCallback(async () => {
    try {
      const next = await getImportJobAction();
      // Auto-publish consumes the job at completion, after which the action
      // returns null — from the building screen that MEANS "done".
      if (!next || next.status !== "running") {
        if (next) setJob(next);
        pushLog(`page ready — logr.it/${usernameRef.current}`);
        setFin(true);
        return;
      }
      for (const c of next.sources) {
        const prev = chipStatusRef.current.get(c.id);
        if (prev !== c.status) {
          chipStatusRef.current.set(c.id, c.status);
          if (c.status === "fetching") pushLog(`reading ${c.label}`);
          if (c.status === "extracting") pushLog(`extracting events from ${c.label}`);
          if (c.status === "done") pushLog(`${c.label} done — ${c.eventCount} event${c.eventCount === 1 ? "" : "s"}`);
          if (c.status === "error") pushLog(`${c.label} skipped — ${c.error ?? "couldn't read it"}`);
        }
      }
      setJob(next);
      pollRef.current = setTimeout(poll, POLL_MS);
    } catch {
      pollRef.current = setTimeout(poll, POLL_MS * 2);
    }
  }, [pushLog]);

  // Create the profile, hand sources to the background import, and watch it
  // assemble the page. The building screen shows instantly — the setup steps
  // narrate themselves into the terminal.
  function startBuild() {
    const { urls, files } = pendingRef.current;
    const hasSources = urls.length > 0 || files.length > 0;
    setError(null);

    if (!hasSources) {
      // nothing to parse — create and go straight to the page
      void (async () => {
        const res = await createProfileAction({ handle, name, bio, avatarUrl: image || null });
        if (!res.ok) { setError(res.error); return; }
        if (events.length) await insertEventsAction(events);
        router.push(`/${res.username}?tour=1`); // arm the first-run page tour
      })();
      return;
    }

    setScreen("building");
    setJob(null);
    setLogs([]);
    setFin(false);
    setExcluded(new Set());
    chipStatusRef.current.clear();

    void (async () => {
      pushLog(`creating logr.it/${handle}`);
      const res = await createProfileAction({ handle, name, bio, avatarUrl: image || null });
      if (!res.ok) {
        setError(res.error);
        setScreen("sources");
        return;
      }
      usernameRef.current = res.username;
      if (events.length) {
        await insertEventsAction(events);
        pushLog(`${events.length} event${events.length === 1 ? "" : "s"} from your story added`);
      }
      const fd = new FormData();
      fd.set("sources", JSON.stringify(urls.map((url) => ({ url }))));
      fd.set("fileKinds", JSON.stringify(files.map((f) => f.kind)));
      for (const f of files) fd.append("file", f.file);
      try {
        const r = await fetch("/api/import", { method: "POST", body: fd });
        if (!r.ok && r.status !== 409) {
          const msg = (await r.json().catch(() => null))?.error ?? "import couldn't start";
          pushLog(`${msg} — your page is up, add events from the dashboard`);
          setFin(true);
          return;
        }
      } catch {
        pushLog("import couldn't start — your page is up, add events from the dashboard");
        setFin(true);
        return;
      }
      pushLog("agent dispatched — reading your sources");
      void poll();
    })();
  }

  function openPage() {
    if (opening) return;
    setOpening(true);
    void (async () => {
      const keys = (job?.events ?? [])
        .filter((e) => excluded.has(evKey(e)))
        .map((e) => ({ dateOn: e.dateOn, title: e.title }));
      if (keys.length) await removeImportedEventsAction(keys).catch(() => {});
      router.push(`/${usernameRef.current || handle}?tour=1`); // arm the first-run page tour
    })();
  }

  // ---- derived building view ----
  const jobEvents = job?.events ?? [];
  const droppedCount = jobEvents.filter((e) => excluded.has(evKey(e))).length;
  const slots = Array.from({ length: Math.max(SLOTS, Math.min(jobEvents.length, 8)) }, (_, i) => jobEvents[i] ?? null)
    .slice(0, Math.max(SLOTS, Math.min(jobEvents.length, 8)));
  const canNextYou = hstate === "ok" && !!name.trim();
  const buildCta = pendingCount > 0 || events.length > 0 ? "build my page →" : "start with an empty page →";

  return (
    <div className="onb" style={{ minHeight: "100dvh", height: "auto" }}>

      {/* ---- slim top bar ---- */}
      <header className="onb2-bar">
        <span className="onb2-bar__brand"><Mark />logr</span>
        <nav className="onb2-bar__crumbs" aria-label="onboarding steps">
          <button
            type="button"
            className={`onb2-crumb${screen === "you" ? " onb2-crumb--active" : " onb2-crumb--done"}`}
            onClick={() => screen !== "building" && setScreen("you")}
          >
            <span className="onb2-crumb__mark">{screen === "you" ? "01" : "✓"}</span>you
          </button>
          <button
            type="button"
            className={`onb2-crumb${screen === "sources" ? " onb2-crumb--active" : screen === "building" ? " onb2-crumb--done" : ""}`}
            onClick={() => screen !== "building" && canNextYou && setScreen("sources")}
          >
            <span className="onb2-crumb__mark">02</span>sources
          </button>
        </nav>
        <span className="onb2-bar__status">
          <span className="onb2-bar__status-dot" aria-hidden="true" />
          {screen !== "building" ? "draft saved" : fin ? "page ready" : "agent working"}
        </span>
      </header>

      <main className="onb2-main">

        {/* ═══ step 1 · you ═══ */}
        {screen === "you" && (
          <div className="onb2-frame">
            <div className="onb2-card">
              <div className="onb2-card__progress"><span /></div>
              <div className="onb2-card__body">
                <div className="onb2-step-head">
                  <div className="onb2-step-head__left">
                    <span className="onb2-step-head__num">01</span>
                    <span className="onb2-step-head__title">you</span>
                  </div>
                  <span className="onb2-step-head__count">1 / 2</span>
                </div>

                <div className="onb2-you-row">
                  <span className="onb2-polaroid">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" />
                    ) : (
                      <span className="onb2-polaroid__letter">{(name || "·").charAt(0).toLowerCase()}</span>
                    )}
                  </span>
                  <div className="onb2-name-col">
                    <input
                      className="onb2-name-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="your name"
                      autoFocus
                    />
                    <span className="onb2-hint">this is the big type on your page</span>
                  </div>
                </div>

                <div className="onb2-handle-row">
                  <span className="onb2-handle-row__prefix">logr.it<em>/</em></span>
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase())}
                    placeholder="handle"
                  />
                  <span className={`onb2-handle-status${hstate === "ok" ? " onb2-handle-status--ok" : hstate === "taken" || hstate === "invalid" ? " onb2-handle-status--bad" : ""}`}>
                    {hstate === "checking" && <><span className="onb2-handle-status__dot" />checking…</>}
                    {hstate === "ok" && <><span className="onb2-handle-status__dot" />available</>}
                    {hstate === "taken" && "taken"}
                    {hstate === "invalid" && (herror ?? "invalid")}
                  </span>
                </div>

                <textarea
                  className="onb2-bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="one line about you (we'll draft one from your sources if you skip it)"
                />

                <div className="onb2-actions onb2-actions--end">
                  <button type="button" className="onb2-btn" onClick={() => setScreen("sources")} disabled={!canNextYou}>
                    next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ step 2 · sources ═══ */}
        {screen === "sources" && (
          <div className="onb2-frame">
            <div className="onb2-card">
              <div className="onb2-card__progress onb2-card__progress--full"><span /></div>
              <div className="onb2-card__body">
                <div className="onb2-step-head">
                  <div className="onb2-step-head__left">
                    <span className="onb2-step-head__num">02</span>
                    <span className="onb2-step-head__title">sources</span>
                  </div>
                  <span className="onb2-step-head__count">2 / 2</span>
                </div>
                <p className="onb2-sub">paste your links — we&apos;ll build the page from them.</p>

                <SourcesInput linkedinEnabled={linkedinEnabled} onChange={onSourcesChange} />

                <button type="button" className="onb2-story-link" onClick={() => setStoryOpen((v) => !v)}>
                  {storyOpen ? "hide the typing box" : "or just type your story →"}
                </button>
                {storyOpen && (
                  <>
                    <textarea
                      className="onb2-bio"
                      rows={5}
                      value={story}
                      onChange={(e) => {
                        setStory(e.target.value);
                        setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length);
                      }}
                      placeholder="Founded Consenso Labs in 2019. Won the AA hackathon in April 2023 with ZenGuard. Launched brewit in April 2025…"
                      autoFocus
                    />
                    <span className="onb2-hint">
                      {reading ? "reading your story…" : events.length ? `${events.length} event${events.length > 1 ? "s" : ""} drafted from your story` : "we'll find the dates"}
                    </span>
                  </>
                )}

                {error && <p className="onb__error">{error}</p>}

                <div className="onb2-actions">
                  <button type="button" className="onb2-back" onClick={() => setScreen("you")}>← back</button>
                  <button type="button" className="onb2-btn onb2-btn--accent" onClick={startBuild} disabled={!canNextYou}>
                    {buildCta}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ building · agentic loader ═══ */}
        {screen === "building" && (
          <div className={`onb2-bld${fin ? " onb2-bld--done" : ""}`}>
            <div className="onb2-bld__top">
              <AgentMascot />
              <span className="onb2-bld__headline">
                {fin ? "your page is ready." : "the agent is reading your sources…"}
              </span>
              <span className="onb2-bld__count">
                <em>{String(jobEvents.length).padStart(2, "0")}</em> events drafted · logr.it/{handle || "you"}
              </span>
              {fin && (
                <button type="button" className="onb2-open__btn onb2-open__btn--top" onClick={openPage} disabled={opening}>
                  <span>{opening ? "opening…" : `open logr.it/${handle || "you"}`}</span><span>→</span>
                </button>
              )}
            </div>

            {/* timeline fills in */}
            <div className="onb2-tlcard">
              <div className="onb2-tl">
                <span className="onb2-tl__rail" aria-hidden="true" />
                {slots.map((e, i) => {
                  if (!e) {
                    return (
                      <div key={`sk-${i}`} className="onb2-slot">
                        <span className="onb2-slot__dot" />
                        <div className="onb2-slot__sk">
                          <span className="onb2-slot__bar" style={{ width: `${62 - i * 6}%` }}><span /></span>
                          <span className="onb2-slot__bar onb2-slot__bar--dim" style={{ width: `${38 - i * 4}%` }} />
                        </div>
                      </div>
                    );
                  }
                  const off = excluded.has(evKey(e));
                  return (
                    <div
                      key={evKey(e)}
                      className={`onb2-slot onb2-slot--filled${off ? " onb2-slot--off" : ""}`}
                      title={off ? "tap to keep" : "tap to leave out"}
                      onClick={() =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          const k = evKey(e);
                          if (next.has(k)) next.delete(k);
                          else next.add(k);
                          return next;
                        })
                      }
                    >
                      <span className="onb2-slot__dot" />
                      <div className="onb2-slot__in">
                        <div className="onb2-slot__meta">
                          <em>{monthYear(e.dateOn)}</em> · {e.tags[0] ?? "work"} <i>— via {viaOf(e)}</i>
                        </div>
                        <div className="onb2-slot__title">{e.icon ? `${e.icon} ` : ""}{e.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="onb2-tl__foot">
                <span>tap an event to leave it out — the agent keeps going</span>
                <em>
                  {jobEvents.length > slots.length ? `+${jobEvents.length - slots.length} more · ` : ""}
                  {droppedCount ? `${droppedCount} left out` : ""}
                </em>
              </div>
            </div>

            {/* agent terminal */}
            <div className="onb2-term">
              <div className="onb2-term__head">
                <span className="onb2-term__title">
                  <span className="onb2-term__mini" aria-hidden="true">
                    <span className="onb2-term__mini-head">
                      <span className="onb2-term__mini-eyes"><span /><span /></span>
                    </span>
                    <span className="onb2-term__mini-dot" />
                  </span>
                  building this page
                </span>
                <span className="onb2-term__stats">
                  {(job?.sources ?? []).map((c) => (
                    <span
                      key={c.id}
                      className={`onb2-term__stat${
                        c.status === "done" ? " onb2-term__stat--done"
                        : c.status === "error" ? " onb2-term__stat--err"
                        : c.status === "queued" ? "" : " onb2-term__stat--live"
                      }`}
                    >
                      {c.label.split("/")[0]} {c.status === "done" ? `✓ ${c.eventCount}` : c.status === "error" ? "✗" : c.status}
                    </span>
                  ))}
                </span>
              </div>
              <div className="onb2-term__lines">
                {logs.map((l, i) => (
                  <div key={`${i}-${l}`} className={`onb2-term__line${i === logs.length - 1 ? " onb2-term__line--last" : ""}`} style={{ opacity: 0.45 + 0.55 * ((i + 1) / logs.length) }}>
                    ▸ {l}
                  </div>
                ))}
                <span className="onb2-term__cursor" aria-hidden="true" />
              </div>
            </div>

            <div className="onb2-open">
              {fin && (
                <button type="button" className="onb2-open__btn" onClick={openPage} disabled={opening}>
                  <span>{opening ? "opening…" : `open logr.it/${handle || "you"}`}</span><span>→</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
