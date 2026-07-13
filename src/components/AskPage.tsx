"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import { themeCssVars, PALETTES } from "@/lib/theme";
import { Mark } from "@/components/Mark";
import { ChatPanel } from "@/components/ChatPanel";
import { seedQuestions } from "@/lib/suggest";
import { SITE_URL } from "@/lib/site";
import type { ProfileDTO } from "@/lib/profile";

/**
 * Dedicated, shareable home for the grounded chat at /[username]/ask.
 * Wears the owner's saved palette (same CSS-variable tokens as the timeline)
 * and renders the shared ChatPanel — the exact modal experience, full-bleed.
 * A conversation started in the modal carries over via sessionStorage.
 */
export function AskPage({ profile }: { profile: ProfileDTO }) {
  const vars = themeCssVars(profile.theme) as CSSProperties;
  const dark = PALETTES[profile.theme.palette]?.dark;
  const first = profile.name.split(" ")[0].toLowerCase();
  const seeds = useMemo(() => seedQuestions(profile), [profile]);
  const host = new URL(SITE_URL).hostname;

  return (
    <div className="logr" data-mode={dark ? "dark" : "light"} style={vars}>
      <div className="ask-page">
        <header className="bar">
          <span className="bar__brand"><Link href="/"><Mark />logr</Link></span>
          <nav className="bar__util" aria-label="utilities">
            <Link href={`/${profile.username}`}>← timeline</Link>
          </nav>
        </header>

        <section className="ask-page__hero">
          <p className="ask-page__handle">
            {host}<span className="accent">/</span>{profile.username}<span className="accent">/</span>ask
          </p>
          <h1 className="ask-page__title">ask about {profile.name.toLowerCase()}</h1>
          <p className="ask-page__sub">
            a grounded conversation — answers come only from {first}&apos;s recorded log, never invented.
          </p>
        </section>

        <div className="ask-page__panel" role="region" aria-label={`ask about ${profile.name}`}>
          <ChatPanel username={profile.username} name={profile.name} suggestions={seeds} />
        </div>

        <footer className="ask-page__foot">
          <span><Mark /> logr — just logr it.</span>
          <span>read by humans <span className="accent">·</span> asked by anyone</span>
        </footer>
      </div>
    </div>
  );
}
