"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { themeCssVars, PALETTES } from "@/lib/theme";
import { Mark } from "@/components/Mark";
import { AgentAvatar, type AgentState } from "@/components/AgentAvatar";
import { ChatPanel } from "@/components/ChatPanel";
import { ShareModal } from "@/components/ShareModal";
import { seedQuestions } from "@/lib/suggest";
import { SITE_URL } from "@/lib/site";
import type { ProfileDTO } from "@/lib/profile";

/**
 * Dedicated, shareable home for the grounded chat at /[username]/ask.
 * Wears the owner's saved palette (same CSS-variable tokens as the timeline)
 * and renders the shared ChatPanel — the exact modal experience, full-bleed.
 * A conversation started in the modal carries over via sessionStorage.
 */
// The hero loggy lives a little life up top, like the promo video: it reads,
// scribbles notes, celebrates (closed happy eyes + hop), works, dozes off,
// gets confused, and loops. Reduced motion pins it to a calm idle.
const HERO_LOOP: [AgentState, number][] = [
  ["idle", 6000],
  ["reading", 5200],
  ["notes", 4600],
  ["success", 2600],
  ["idle", 5000],
  ["working", 4400],
  ["sleeping", 6500],
  ["confused", 2400],
];

function HeroLoggy() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % HERO_LOOP.length), HERO_LOOP[step][1]);
    return () => clearTimeout(t);
  }, [step]);
  return <AgentAvatar state={HERO_LOOP[step][0]} size={30} entrance />;
}

export function AskPage({ profile }: { profile: ProfileDTO }) {
  const [shareOpen, setShareOpen] = useState(false);
  const vars = themeCssVars(profile.theme) as CSSProperties;
  const dark = PALETTES[profile.theme.palette]?.dark;
  const first = profile.name.split(" ")[0].toLowerCase();
  const seeds = useMemo(() => seedQuestions(profile), [profile]);
  const host = new URL(SITE_URL).hostname;
  // chat warmup, same as the profile page: one early GET pre-builds the system
  // prompt and seeds the provider's prompt cache so the first question streams
  // fast; its AI-personalized questions (server-cached per profile) lead the
  // chips ahead of the templated seeds. The route 404s when chat is disabled,
  // so no gate is needed here.
  const [aiAsk, setAiAsk] = useState<string[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/${profile.username}/chat`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { suggestions?: unknown } | null) => {
          const list = Array.isArray(d?.suggestions)
            ? d.suggestions.filter((s): s is string => typeof s === "string")
            : [];
          if (list.length) setAiAsk(list);
        })
        .catch(() => { /* warmup is best-effort */ });
    }, 400); // let first paint win the connection
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [profile.username]);
  const suggestions = useMemo(() => {
    const merged = [...aiAsk, ...seeds];
    return merged.filter((q, i) => merged.indexOf(q) === i);
  }, [aiAsk, seeds]);

  return (
    <div className="logr" data-mode={dark ? "dark" : "light"} style={vars}>
      <div className="ask-shell">
        <header className="bar">
          <div className="bar__inner">
            <span className="bar__brand"><Link href="/"><Mark />logr</Link></span>
            <nav className="bar__util" aria-label="utilities">
              <button type="button" onClick={() => setShareOpen(true)} aria-label="share">
                <svg className="bar__util__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                  <path d="M8 10V2.5M8 2.5L5.5 5M8 2.5L10.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 8v4.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" strokeLinecap="round" />
                </svg>
                <span className="bar__util__label">share</span>
              </button>
              <Link href={`/${profile.username}`}>
                <svg className="bar__util__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                  <line x1="5" y1="4" x2="13.5" y2="4" strokeLinecap="round" />
                  <line x1="5" y1="8" x2="12" y2="8" strokeLinecap="round" />
                  <line x1="5" y1="12" x2="13" y2="12" strokeLinecap="round" />
                  <circle cx="2.4" cy="4" r="0.9" fill="currentColor" stroke="none" />
                  <circle cx="2.4" cy="8" r="0.9" fill="currentColor" stroke="none" />
                  <circle cx="2.4" cy="12" r="0.9" fill="currentColor" stroke="none" />
                </svg>
                <span className="bar__util__label">timeline</span>
              </Link>
            </nav>
          </div>
        </header>

        <div className="ask-page">
        <section className="ask-page__hero">
          <Link className="ask-page__ava" href={`/${profile.username}`} aria-label={`${profile.name}'s timeline`}>
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.name} />
            ) : (
              <span className="ask-page__ava__initial" aria-hidden="true">{first.charAt(0)}</span>
            )}
          </Link>
          <div className="ask-page__intro">
            <p className="ask-page__handle">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <rect x="3" y="5.5" width="10" height="7.6" rx="2.2" />
                <circle cx="6.1" cy="9.3" r="0.95" fill="currentColor" stroke="none" />
                <circle cx="9.9" cy="9.3" r="0.95" fill="currentColor" stroke="none" />
                <line x1="8" y1="3" x2="8" y2="5.5" strokeLinecap="round" />
                <circle cx="8" cy="2.4" r="1" fill="currentColor" stroke="none" />
              </svg>
              {host}<span className="accent">/</span>{profile.username}<span className="accent">/</span>ask
            </p>
            <h1 className="ask-page__title">
              ask about {profile.name.toLowerCase()}<span className="ask-page__caret" aria-hidden="true" />
            </h1>
            <p className="ask-page__sub">
              a grounded conversation — answers come only from {first}&apos;s recorded log, never invented.
            </p>
          </div>
          <span className="ask-page__agent">
            <HeroLoggy />
          </span>
        </section>

        <div className="ask-page__panel" role="region" aria-label={`ask about ${profile.name}`}>
          <ChatPanel username={profile.username} name={profile.name} suggestions={suggestions} variant="page" />
        </div>

        <footer className="ask-page__foot">
          <span><Mark /> logr — just logr it.</span>
          <span>read by humans <span className="accent">·</span> asked by anyone</span>
        </footer>
        </div>

        <ShareModal
          username={profile.username}
          name={profile.name}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          withAsk
        />
      </div>
    </div>
  );
}
