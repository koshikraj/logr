"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { themeCssVars, PALETTES, type Theme } from "@/lib/theme";
import { Mark } from "@/components/Mark";
import { ChatPanel } from "@/components/ChatPanel";
import type { ProfileDTO } from "@/lib/profile";

/**
 * Standalone, shareable home for the grounded chat at `/[username]/ask`.
 * Wears the owner's saved palette (same CSS-variable tokens as the timeline)
 * so it feels of-a-piece, and renders the shared `ChatPanel` — no duplicate
 * chat logic. The floating layout picker is intentionally absent: this page
 * is the chat, full-bleed.
 */
export function AskPage({ profile }: { profile: ProfileDTO }) {
  const theme: Theme = {
    palette: profile.theme.palette,
    layout: profile.theme.layout,
    accentOverride: profile.theme.accentOverride,
  };
  const vars = themeCssVars(theme) as CSSProperties;
  const dark = PALETTES[theme.palette]?.dark;
  const first = profile.name.split(" ")[0].toLowerCase();

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
            logr.life<span className="accent">/</span>{profile.username}<span className="accent">/</span>ask
          </p>
          <h1 className="ask-page__title">ask about {profile.name}</h1>
          <p className="ask-page__sub">
            a grounded conversation — answers come only from {first}&apos;s recorded log,
            never invented. ask about their work, milestones, or what they&apos;re building now.
          </p>
        </section>

        <div className="ask-page__panel" role="region" aria-label={`ask about ${profile.name}`}>
          <ChatPanel username={profile.username} name={profile.name} variant="page" />
        </div>

        <footer className="foot">
          <span className="brand"><Mark />logr — log your life.</span>
          <span>read by humans <span className="accent">·</span> ingested by machines</span>
        </footer>
      </div>
    </div>
  );
}
