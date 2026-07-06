"use client";

import { useState, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { ToastProvider } from "@/components/ui/Toast";
import { StyleVarsProvider } from "@/components/ui/StyleVars";
import { ProfileForm } from "./ProfileForm";
import { ThemeEditor } from "./ThemeEditor";
import { EventsManager, type EditableEvent } from "./EventsManager";
import { logoutAction } from "@/lib/actions";
import { themeCssVars, type Theme } from "@/lib/theme";
import { Mark } from "@/components/Mark";
import Portfolio from "@/components/Portfolio";
import type { ProfileDTO, EventDTO } from "@/lib/profile";

const TABS = [
  { value: "profile", glyph: "01", label: "profile" },
  { value: "events", glyph: "02", label: "events" },
  { value: "appearance", glyph: "03", label: "appearance" },
];

function initial(name: string) {
  return (name.trim().charAt(0) || "·").toLowerCase();
}

/** dashboard EditableEvent → the EventDTO the public timeline renders */
function toEventDTO(e: EditableEvent): EventDTO {
  return {
    id: e.id,
    dateOn: e.dateOn,
    date: e.date,
    year: Number(e.dateOn?.slice(0, 4)) || 0,
    title: e.title,
    tags: e.tags,
    featured: e.featured,
    fullDate: e.fullDate,
    body: e.body,
    icon: e.icon,
    link: e.linkHref ? { label: e.linkLabel ?? e.linkHref, href: e.linkHref } : null,
    sourceUrl: null,
    media: e.media,
  };
}

export function AdminShell({
  profile,
  events,
  xConnected = null,
}: {
  profile: ProfileDTO;
  events: EditableEvent[];
  /** true = linked, false = offer connect, null = X auth not configured */
  xConnected?: boolean | null;
}) {
  const [tab, setTab] = useState("profile");
  // owner's theme draft — drives the dashboard's own look + the live preview
  const [theme, setTheme] = useState<Theme>(profile.theme);
  const vars = themeCssVars(theme) as CSSProperties;

  // live drafts that feed the preview without waiting for a save
  const [draft, setDraft] = useState<Partial<ProfileDTO>>({
    name: profile.name, username: profile.username, bio: profile.bio, status: profile.status,
    location: profile.location, about: profile.about, socials: profile.socials, avatarUrl: profile.avatarUrl,
  });
  const [items, setItems] = useState<EditableEvent[]>(events);

  // compose the draft into a ProfileDTO the (preview-mode) timeline can render
  const previewProfile = useMemo<ProfileDTO>(() => ({
    ...profile,
    ...draft,
    theme,
    events: [...items].sort((a, b) => a.position - b.position).map(toEventDTO),
  }), [profile, draft, theme, items]);

  return (
    <StyleVarsProvider vars={vars}>
      <ToastProvider>
        <div className="dash" data-mode={theme.palette === "ink" ? "dark" : "light"} style={vars}>
          {/* top bar — logo + status aligned uniform with the onboarding flow */}
          <header className="bar">
            <div className="bar__inner">
              <span className="bar__brand">
                <Link href="/"><Mark />logr</Link>
                <span className="chip">dashboard</span>
              </span>
              <nav className="bar__util" aria-label="utilities">
                <span className="bar__saved" aria-hidden="true"><span className="bar__saved__dot" />saved</span>
                {xConnected === false && <a href="/api/x/connect">connect 𝕏</a>}
                {xConnected === true && <span title="X account linked — you can sign in with X">𝕏 linked</span>}
                <a href={`/${profile.username}`} target="_blank" rel="noopener noreferrer">open ↗</a>
                <form action={logoutAction}><button type="submit">sign out</button></form>
              </nav>
            </div>
          </header>

          {/* two-pane split: editor (left) · live preview (right) — each scrolls */}
          <div className="dash-split">
            <div className="dash-edit">
              <div className="page">
                <section className="hero">
                  <span className="hero__avatar">
                    {previewProfile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewProfile.avatarUrl} alt="" />
                    ) : (
                      <span className="hero__avatar__initial">{initial(previewProfile.name)}</span>
                    )}
                  </span>
                  <div className="hero__copy">
                    <h1 className="hero__name">{previewProfile.name}<span className="colon">:</span></h1>
                    <p className="hero__sub">edit on the left — watch it live on the right.</p>
                  </div>
                </section>

                <nav className="tabs" role="tablist" aria-label="dashboard sections">
                  {TABS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className="tab"
                      role="tab"
                      aria-current={tab === t.value}
                      onClick={() => setTab(t.value)}
                    >
                      <span className="tab__glyph">{t.glyph}</span>
                      {t.label}
                    </button>
                  ))}
                </nav>

                {tab === "profile" && <ProfileForm profile={profile} onDraftChange={(p) => setDraft((d) => ({ ...d, ...p }))} />}
                {tab === "appearance" && <ThemeEditor theme={theme} onChange={setTheme} />}
                {tab === "events" && <EventsManager events={events} username={profile.username} onItemsChange={setItems} />}
              </div>
            </div>

            <div className="dash-split__rule" aria-hidden="true" />

            <aside className="dash-preview" aria-label="live preview of your page">
              <div className="dash-preview__bar">
                <span className="dash-preview__url">logr.life<span className="accent">/</span>{previewProfile.username}</span>
                <span className="dash-preview__live"><span className="dash-preview__live__dot" />live</span>
              </div>
              <div className="dash-preview__frame">
                <div className="preview-zoom">
                  <Portfolio profile={previewProfile} previewMode chatEnabled={false} loggedIn={false} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </ToastProvider>
    </StyleVarsProvider>
  );
}
