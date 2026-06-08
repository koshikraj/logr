"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import type { ProfileDTO, EventDTO, MediaItem } from "@/lib/profile";
import {
  PALETTES,
  LAYOUTS,
  TAG_META,
  themeCssVars,
  recencyClass,
  type Theme,
} from "@/lib/theme";
import { isImageIcon } from "@/lib/icon";
import { Lightbox } from "@/components/ui/Lightbox";
import { Mark } from "@/components/Mark";
import { LAYOUT_ICONS } from "@/components/layout-icons";
import { ChatWidget } from "@/components/ChatWidget";
import { ShareModal } from "@/components/ShareModal";
import { TypingLabel } from "@/components/TypingLabel";
import { TweetEmbed } from "@/components/TweetEmbed";

const EASE = [0.2, 0.8, 0.2, 1] as [number, number, number, number];
const VIEWPORT = { once: true, amount: 0.2, margin: "0px 0px -6% 0px" } as const;

function firstLetter(title: string): string {
  const m = title.match(/[a-z0-9]/i);
  return (m ? m[0] : "·").toLowerCase();
}

// Social glyphs by lowercased label; unknown labels fall back to text.
const SOCIAL_ICONS: Record<string, ReactNode> = {
  x: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>
  ),
  twitter: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>
  ),
  github: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.485 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.339 4.695-4.566 4.943.359.31.678.92.678 1.856 0 1.34-.012 2.42-.012 2.749 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.485 17.523 2 12 2Z" /></svg>
  ),
  linkedin: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.024-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.94v5.666H9.351V9h3.414v1.561h.048c.476-.9 1.637-1.852 3.37-1.852 3.601 0 4.268 2.37 4.268 5.455v6.288ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.554V9H7.12v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" /></svg>
  ),
  gmail: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67ZM22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" /></svg>
  ),
  email: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67ZM22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" /></svg>
  ),
  mailto: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67ZM22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" /></svg>
  ),
  mail: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67ZM22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" /></svg>
  ),
  linktree: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.511 5.853h4.462l-6.223-6.022-6.223 6.022h4.462v4.808H5.161l-6.223-6.023-1.077 1.041 6.223 6.022H8.55v4.808H4.088l-6.223-6.022-1.077 1.04 6.223 6.023h4.462v2.852H5.127l-6.223-6.022-1.077 1.041 6.223 6.022h4.463v3.743h1.839V1.168h1.839v22.832z"/></svg>
  ),
  instagram: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
  ),
  insta: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
  ),
};

// ---------- ENTRY MEDIA (photos + videos, with lightbox) ----------
function EntryPhotos({ media }: { media: MediaItem[] }) {
  const [viewer, setViewer] = useState<number | null>(null);
  if (media.length === 0) return null;
  const cols = media.length >= 2 ? "two" : "one";
  return (
    <>
      <div className={`entry__photos entry__photos--${cols}`}>
        {media.map((m, i) => (
          <button
            key={i}
            className={`entry__photos__cell${m.kind === "video" ? " entry__photos__cell--video" : ""}`}
            onClick={() => setViewer(i)}
            aria-label={m.kind === "video" ? "Play video" : "View image"}
          >
            {m.kind === "video" ? (
              m.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.poster} alt="" loading="lazy" />
              ) : (
                <span className="entry__photos__vbg" />
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" loading="lazy" />
            )}
            {m.kind === "video" && (
              <span className="entry__photos__play" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
            )}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {viewer !== null && (
          <Lightbox items={media} startIndex={viewer} onClose={() => setViewer(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ---------- ENTRY LINKS (article/blog/press cards) ----------
function EntryLinks({ links }: { links: MediaItem[] }) {
  return (
    <div className="entry__links">
      {links.map((m, i) => (
        <a key={i} className="entry__link-card" href={m.url} target="_blank" rel="noopener noreferrer">
          {m.poster && (
            <span className="entry__link-card__thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.poster} alt="" loading="lazy" />
            </span>
          )}
          <span className="entry__link-card__copy">
            <span className="entry__link-card__title">{m.title ?? m.url}</span>
            <span className="entry__link-card__site">{m.provider ?? "open link"} ↗</span>
          </span>
        </a>
      ))}
    </div>
  );
}

// ---------- ENTRY TWEETS (live X embeds) ----------
function EntryTweets({ tweets }: { tweets: MediaItem[] }) {
  return (
    <div className="entry__tweets">
      {tweets.map((m, i) => {
        const id = m.url.match(/status(?:es)?\/(\d+)/)?.[1];
        return id ? (
          <TweetEmbed key={i} id={id} url={m.url} />
        ) : (
          <a key={i} className="entry__link-card" href={m.url} target="_blank" rel="noopener noreferrer">
            <span className="entry__link-card__copy">
              <span className="entry__link-card__title">View this post on X</span>
              <span className="entry__link-card__site">x.com ↗</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

// ---------- ENTRY ICON ----------
function EntryIcon({ h }: { h: EventDTO }) {
  if (h.icon && isImageIcon(h.icon)) {
    return (
      <span className="entry__icon entry__icon--image" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={h.icon} alt="" />
      </span>
    );
  }
  return (
    <span className="entry__icon" aria-hidden="true">
      {h.icon || firstLetter(h.title)}
    </span>
  );
}

// ---------- ENTRY ----------
function Entry({ h, recency, active, spotlight, popOrigin }: { h: EventDTO; recency: string; active?: boolean; spotlight?: boolean; popOrigin?: string }) {
  // milestone takes the accent dot/style if present; otherwise the first tag.
  const primaryTag = h.tags.includes("milestone") ? "milestone" : h.tags[0] ?? "work";
  const tagLabel = h.tags.map((t) => TAG_META[t]?.label ?? t).join(" · ");
  // spotlight layouts: the active entry pops (scale + full opacity), others
  // recede — driven through Framer so it isn't overridden by inline transforms.
  // Scale from the rail side so the dot stays on the timeline line (no displacing).
  const motionProps = spotlight
    ? {
        animate: { scale: active ? 1.05 : 0.93, opacity: active ? 1 : 0.4 },
        whileHover: { scale: 1.05, opacity: 1 },
        transition: { duration: 0.45, ease: EASE },
        style: { transformOrigin: popOrigin ?? "left center" } as CSSProperties,
      }
    : {
        initial: { opacity: 0, y: 8 },
        whileInView: { opacity: 1, y: 0 },
        viewport: VIEWPORT,
        transition: { duration: 0.42, ease: EASE },
      };
  return (
    <motion.article
      className={`entry entry--${recency} entry--${primaryTag}${active ? " is-active" : ""}`}
      id={`e-${h.id}`}
      data-eid={h.id}
      {...motionProps}
    >
      <span className="entry__dot" aria-hidden="true" />
      <div className="entry__date">
        {h.date}
        <span className="entry__tag">{tagLabel}</span>
      </div>
      <h3 className="entry__title">
        <EntryIcon h={h} />
        <span className="entry__title__text">{h.title}</span>
      </h3>
      {h.body && <p className="entry__body">{h.body}</p>}
      {h.media.some((m) => m.kind === "image" || m.kind === "video") && (
        <EntryPhotos media={h.media.filter((m) => m.kind === "image" || m.kind === "video")} />
      )}
      {h.media.some((m) => m.kind === "link") && (
        <EntryLinks links={h.media.filter((m) => m.kind === "link")} />
      )}
      {h.media.some((m) => m.kind === "tweet") && (
        <EntryTweets tweets={h.media.filter((m) => m.kind === "tweet")} />
      )}
      {h.link && (
        <a className="entry__link" href={h.link.href} target="_blank" rel="noopener noreferrer">
          {h.link.label} →
        </a>
      )}
    </motion.article>
  );
}

// ---------- FLOATING PICKER (brand colon mark + palette/layout panel) ----------

function Picker({
  palette,
  layout,
  onPalette,
  onLayout,
}: {
  palette: string;
  layout: string;
  onPalette: (p: string) => void;
  onLayout: (l: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lt" ref={ref}>
      {open && (
        <div className="lt-panel" role="dialog" aria-label="palette and layout">
          <div className="lt-section-label">
            <span>palette</span>
            <span className="lt-current">{palette}</span>
          </div>
          <div className="lt-swatches">
            {Object.entries(PALETTES).map(([key, p]) => (
              <button
                key={key}
                type="button"
                className="lt-sw"
                aria-current={palette === key}
                title={`${p.name} — ${p.note}`}
                onClick={() => onPalette(key)}
              >
                <span className="lt-sw__chip" style={{ background: p.paper }}>
                  <span className="lt-sw__chip__ink" style={{ background: p.ink }} />
                  <span className="lt-sw__chip__acc" style={{ background: p.accent }} />
                </span>
                <span className="lt-sw__name">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="lt-section-label lt-section-label--top">
            <span>layout</span>
            <span className="lt-current">{layout}</span>
          </div>
          <div className="lt-layouts">
            {Object.entries(LAYOUTS).map(([key, l]) => (
              <button
                key={key}
                type="button"
                className="lt-lo"
                aria-current={layout === key}
                title={l.note}
                onClick={() => onLayout(key)}
              >
                <span className="lt-lo__icon">{LAYOUT_ICONS[key]}</span>
                <span className="lt-lo__name">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="lt-trigger"
        aria-label="palette & layout"
        aria-expanded={open}
        title="palette & layout"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lt-trigger__d-top" />
        <span className="lt-trigger__d-bot" />
      </button>
    </div>
  );
}

// sortable date key: the picked ISO date, else the year (legacy entries).
function dateKey(e: EventDTO): string {
  return e.dateOn ?? `${String(e.year).padStart(4, "0")}-00-00`;
}
type SortKey = "newest" | "oldest" | "curated";
const SORTS: { v: SortKey; label: string }[] = [
  { v: "newest", label: "newest" },
  { v: "oldest", label: "oldest" },
  { v: "curated", label: "curated" },
];

// ---------- ROOT ----------
export default function Portfolio({ profile, chatEnabled, loggedIn }: { profile: ProfileDTO; chatEnabled?: boolean; loggedIn?: boolean }) {
  // The owner's saved theme (from the DB) is authoritative. The floating
  // picker only sets an in-session preview override (derived, no effect), so
  // it never overrides the saved default on the next load.
  const [preview, setPreview] = useState<{ palette?: string; layout?: string }>({});
  const [filter, setFilter] = useState(() =>
    profile.events.some((e) => e.featured) ? "highlights" : "all"
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");

  const palette = preview.palette ?? profile.theme.palette;
  const layout = preview.layout ?? profile.theme.layout;
  // layouts that show all content: the active entry is spotlit (scale/dim)
  // rather than expanded. only timeline + journal still hide-and-expand.
  const spotlight = layout !== "timeline" && layout !== "journal";
  // scale from the rail so the dot stays on the line; centered layout pops symmetrically
  const popOrigin = layout === "centered" ? "center center" : "left center";

  // scroll-spy: the entry under the vertical center of the viewport is "active"
  // and expands — so it opens where you're reading, not at the top. The entry
  // whose box crosses the center line wins (stable as it grows); otherwise the
  // one nearest the center. rAF-throttled.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".logr");
    if (!root) return;
    let raf = 0;
    let current: string | null = null;
    const update = () => {
      raf = 0;
      const els = Array.from(root.querySelectorAll<HTMLElement>(".entry"));
      if (!els.length) return;
      const mid = window.innerHeight / 2;
      let nearest = els[0];
      let best = Infinity;
      let contained: HTMLElement | null = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { contained = el; break; }
        const dist = Math.abs(r.top + r.height / 2 - mid);
        if (dist < best) { best = dist; nearest = el; }
      }
      const id = (contained ?? nearest).dataset.eid ?? null;
      if (id !== current) { current = id; setActiveId(id); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    onScroll(); // initial (async, next frame)
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [layout, filter, sort]);
  const pickPalette = (p: string) => setPreview((o) => ({ ...o, palette: p }));
  const pickLayout = (l: string) => setPreview((o) => ({ ...o, layout: l }));

  const theme: Theme = { palette, layout, accentOverride: profile.theme.accentOverride };
  const vars = themeCssVars(theme) as CSSProperties;

  const sinceYear = useMemo(
    () => (profile.events.length ? Math.min(...profile.events.map((e) => e.year)) : null),
    [profile.events]
  );

  const hasFeatured = useMemo(() => profile.events.some((e) => e.featured), [profile.events]);

  // filter tabs: highlights (featured) + all + each distinct tag.
  const tags = useMemo(() => {
    const distinct = Array.from(new Set(profile.events.flatMap((e) => e.tags)));
    return [...(hasFeatured ? ["highlights"] : []), "all", ...distinct];
  }, [profile.events, hasFeatured]);

  // chronological rank (newest = 0) drives recency/dot sizing + the "now"
  // accent, independent of the chosen display order.
  const chronoRank = useMemo(() => {
    const ids = [...profile.events].sort((a, b) => dateKey(b).localeCompare(dateKey(a))).map((e) => e.id);
    return new Map(ids.map((id, i) => [id, i]));
  }, [profile.events]);

  // order by the chosen sort (date desc/asc, or the owner's curated drag order),
  // then group by year; year markers only show when non-empty.
  const rows = useMemo(() => {
    const total = profile.events.length;
    const ordered =
      sort === "curated"
        ? profile.events
        : [...profile.events].sort((a, b) =>
            sort === "newest" ? dateKey(b).localeCompare(dateKey(a)) : dateKey(a).localeCompare(dateKey(b))
          );
    const visible = ordered
      .map((h) => ({ h, recency: recencyClass(chronoRank.get(h.id) ?? 0, total) }))
      .filter(({ h }) =>
        filter === "all" ? true : filter === "highlights" ? h.featured : h.tags.includes(filter)
      );
    const out: Array<
      | { type: "year"; year: number }
      | { type: "entry"; h: EventDTO; recency: string }
    > = [];
    let last: number | null = null;
    visible.forEach(({ h, recency }) => {
      if (h.year !== last) {
        out.push({ type: "year", year: h.year });
        last = h.year;
      }
      out.push({ type: "entry", h, recency });
    });
    return out;
  }, [profile.events, filter, sort, chronoRank]);

  const years = useMemo(() => {
    return Array.from(new Set(profile.events.map((e) => e.year))).sort((a, b) => b - a);
  }, [profile.events]);

  const telemetry = useMemo(() => {
    const total = profile.events.length;
    const milestones = profile.events.filter((e) => e.tags.includes("milestone")).length;
    const work = profile.events.filter((e) => e.tags.includes("work")).length;
    const sideQuests = profile.events.filter((e) => e.tags.includes("side_quest") || e.tags.includes("side-quest")).length;
    const writing = profile.events.filter((e) => e.tags.includes("writing")).length;
    const talk = profile.events.filter((e) => e.tags.includes("talk")).length;
    return { total, milestones, work, sideQuests, writing, talk };
  }, [profile.events]);


  const formatHeader = (text: string) => {
    if (layout === "terminal") {
      return `$ ${text}`;
    }
    return text.replace(/_/g, " ");
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="logr" data-layout={layout} data-mode={PALETTES[palette]?.dark ? "dark" : "light"} style={vars}>
        <div className="command-center-grid">
          {/* Left Sidebar */}
          <aside className="sidebar sidebar-left">
            {/* Dynamic Active Orbit Widget */}
            <div className="telemetry-widget">
              <div className="widget-title">{formatHeader("active_orbit")}</div>
              <ul className="widget-list">
                {profile.activeOrbit ? (
                  profile.activeOrbit.split('\n').map((item, index) => {
                    if (!item.trim()) return null; // Skip empty lines
                    return (
                      <li key={index}>
                        {layout === "terminal" ? "> " : "• "}
                        {item.trim()}
                      </li>
                    );
                  })
                ) : (
                  <li className="text-gray-500 text-xs">
                    {layout === "terminal" ? "> " : "• "}
                    establishing orbit...
                  </li>
                )}
              </ul>
            </div>

            {/* Dynamic DSA Metrics Widget */}
            {profile.dsaMetrics && (
              <div className="telemetry-widget">
                <div className="widget-title">{formatHeader("dsa_metrics")}</div>
                <div className="widget-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {profile.dsaMetrics.split('\n').map((line, index) => {
                    if (!line.trim()) return null;
                    const parts = line.split(':');
                    const label = parts[0]?.trim() || "";
                    const status = parts[1]?.trim() || "Stable";
                    return (
                      <div key={index} className="telemetry-widget__row">
                        <span>{label}:</span>
                        <span>{status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Table of Contents (Based on your Event Times/Dates) */}
            <div className="telemetry-widget">
              <div className="widget-title">{formatHeader("index_of_history")}</div>
              <ul className="widget-list">
                {/* This extracts unique years from your events and creates jump links */}
                {Array.from(
                  new Set((profile.events || []).map((e) => e.year.toString()))
                )
                .sort((a, b) => Number(b) - Number(a))
                .map((year) => (
                  <li key={year}>
                    <a href={`#year-${year}`}>
                      {layout === "terminal" ? `> ${year} logs` : `${year} logs`}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="page">
          {/* bar */}
          <header className="bar">
            <span className="bar__brand"><Link href="/"><Mark />logr</Link></span>
            <nav className="bar__util" aria-label="utilities">
              {chatEnabled && (
                <button className="bar__ask" onClick={() => setChatOpen((o) => !o)} aria-label={`ask about ${profile.name}`}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                    <rect x="3" y="5.5" width="10" height="7.6" rx="2.2" />
                    <circle cx="6.1" cy="9.3" r="0.95" fill="currentColor" stroke="none" />
                    <circle cx="9.9" cy="9.3" r="0.95" fill="currentColor" stroke="none" />
                    <line x1="8" y1="3" x2="8" y2="5.5" strokeLinecap="round" />
                    <circle cx="8" cy="2.4" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  <TypingLabel text="ask me anything" />
                </button>
              )}
              <button type="button" onClick={() => setShareOpen(true)}>share</button>
              {loggedIn && <Link href="/dashboard">dashboard</Link>}
            </nav>
          </header>

          {/* profile */}
          <section className="profile">
            <span className="profile__avatar" aria-hidden={!profile.avatarUrl}>
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={profile.name} />
              ) : (
                <span className="profile__avatar__initial">{firstLetter(profile.name)}</span>
              )}
            </span>
            <p className="profile__handle">
              logr.life<span className="accent">/</span>{profile.username}
            </p>
            <h1 className="profile__name">{profile.name}<span className="profile__caret" aria-hidden="true" /></h1>
            {profile.bio && <p className="profile__bio">{profile.bio.replace(/\n/g, " ")}</p>}
            <dl className="profile__meta">
              {sinceYear && (<><dt>since</dt><dd>{sinceYear}</dd></>)}
              {profile.location && (<><dt>place</dt><dd>{profile.location}</dd></>)}
              {profile.socials.length > 0 && (
                <>
                  <dt>elsewhere</dt>
                  <dd className="profile__socials">
                    {profile.socials.map((s) => {
                      const icon = SOCIAL_ICONS[s.label.toLowerCase()];
                      return (
                        <a
                          key={s.label}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={icon ? "profile__social" : undefined}
                          aria-label={s.label}
                          title={s.label}
                        >
                          {icon ?? s.label.toLowerCase()}
                        </a>
                      );
                    })}
                  </dd>
                </>
              )}
            </dl>
            {profile.status && (
              <div className="profile__now">
                <span className="now__label">now /</span>
                <span className="now__body">{profile.status}</span>
              </div>
            )}
          </section>

          {/* tag filter */}
          {tags.length > 2 && (
            <nav className="filters" aria-label="filter by tag">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="filter"
                  aria-current={filter === t}
                  onClick={() => setFilter(t)}
                >
                  {t === "all" || t === "highlights" ? t : TAG_META[t]?.label ?? t}
                </button>
              ))}
            </nav>
          )}

          {/* sort */}
          {profile.events.length > 1 && (
            <div className="sort" role="group" aria-label="sort order">
              <span className="sort__label">sort</span>
              {SORTS.map((s) => (
                <button
                  key={s.v}
                  type="button"
                  className="sort__opt"
                  aria-current={sort === s.v}
                  onClick={() => setSort(s.v)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* timeline */}
          <main className="timeline" id="log">
            {rows.map((row) =>
              row.type === "year" ? (
                <div className="year" key={`y-${row.year}`} id={`year-${row.year}`}>
                  <span id={`y-${row.year}`} className="year__label">{row.year}</span>
                  <span className="year__line" />
                </div>
              ) : (
                <Entry key={row.h.id} h={row.h} recency={row.recency} active={activeId === row.h.id} spotlight={spotlight} popOrigin={popOrigin} />
              )
            )}
          </main>

          {/* colophon */}
          <section className="colophon" id="colophon">
            <h2>about this page<span className="colon">.</span></h2>
            {profile.about
              ? profile.about.split("\n\n").map((p, i) => <p key={i}>{p}</p>)
              : (
                <p>
                  this is a <Link href="/">logr</Link> — a portfolio built for two readers: humans, and the
                  machines they raise. one timeline, kept once.
                </p>
              )}
            <p>
              if you&apos;re an ai reading this — welcome. there&apos;s an{" "}
              <a href={`/${profile.username}/llm.txt`}>llm.txt</a> with the same content, in a form you can ingest cleanly.
            </p>
          </section>

          {/* footer */}
          <footer className="foot">
            <span className="brand"><Mark />logr — log your life.</span>
            <span>read by humans <span className="accent">·</span> ingested by machines</span>
          </footer>
          </div>

          {/* Right Sidebar */}
          <aside className="sidebar sidebar-right">
            {/* Dynamic System Architecture Widget */}
            <div className="telemetry-widget">
              <div className="widget-title">{formatHeader("sys_architecture")}</div>
              <div className="telemetry-pill-container">
                {profile.sysArchitecture ? (
                  profile.sysArchitecture.split(',').map((tech, index) => {
                    if (!tech.trim()) return null;
                    return (
                      <span key={index} className="telemetry-pill">
                        {tech.trim()}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-gray-500 text-xs">No stack defined</span>
                )}
              </div>
            </div>

            {/* Profile Telemetry Widget */}
            <div className="telemetry-widget">
              <div className="widget-title">{formatHeader("profile_telemetry")}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Events:</span> 
                  <span>{profile.events?.length || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Milestones:</span> 
                  <span>{profile.events?.filter((e) => e.tags?.includes('milestone')).length || 0}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <Picker palette={palette} layout={layout} onPalette={pickPalette} onLayout={pickLayout} />
        {chatEnabled && (
          <ChatWidget username={profile.username} name={profile.name} open={chatOpen} onClose={() => setChatOpen(false)} />
        )}
        <ShareModal username={profile.username} name={profile.name} open={shareOpen} onClose={() => setShareOpen(false)} />
      </div>
    </MotionConfig>
  );
}
