"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig, useMotionValue, useTransform, useMotionValueEvent } from "framer-motion";
import type { ProfileDTO, EventDTO, MediaItem } from "@/lib/profile";
import {
  PALETTES,
  LAYOUTS,
  TAG_META,
  themeCssVars,
  recencyClass,
  type Theme,
  type DefaultView,
} from "@/lib/theme";
import { isImageIcon } from "@/lib/icon";
import { parseInstagramUrl } from "@/lib/video";
import { detectPlatform } from "@/lib/socials";
import { seedQuestions } from "@/lib/suggest";
import { SOCIAL_ICONS } from "@/components/social-icons";
import { Lightbox } from "@/components/ui/Lightbox";
import { Mark } from "@/components/Mark";
import { LAYOUT_ICONS } from "@/components/layout-icons";
import { ChatWidget } from "@/components/ChatWidget";
import { ShareModal } from "@/components/ShareModal";
import { ProfileTour } from "@/components/ProfileTour";
import { AskLauncher } from "@/components/AskLauncher";
import { TweetEmbed } from "@/components/TweetEmbed";
import { SeededBanner } from "@/components/SeededBanner";

const EASE = [0.2, 0.8, 0.2, 1] as [number, number, number, number];
const VIEWPORT = { once: true, amount: 0.2, margin: "0px 0px -6% 0px" } as const;

// Right-rail "recent" preview mirrors the OG card: dot size/opacity by recency
// (extra entries fall back to the smallest). See opengraph-image.tsx.
const RC_DOT_SIZES = [11, 9, 7, 5, 4, 4, 4] as const;
const RC_DOT_OPACITIES = [1, 0.92, 0.7, 0.5, 0.4, 0.35, 0.3] as const;

function firstLetter(title: string): string {
  const m = title.match(/[a-z0-9]/i);
  return (m ? m[0] : "·").toLowerCase();
}

// ---------- ENTRY MEDIA (photos + videos, with lightbox) ----------
function EntryPhotos({ media, eventTitle }: { media: MediaItem[]; eventTitle: string }) {
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
              <img src={m.url} alt={m.title || eventTitle} loading="lazy" />
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

// ---------- ENTRY INSTAGRAM (public post embeds, keyless /embed/ iframe) ----------
// Also catches Instagram URLs stored as generic "link" media before the
// dedicated kind existed, so old rows upgrade to embeds without a backfill.
function isInstaMedia(m: MediaItem): boolean {
  return m.kind === "instagram" || (m.kind === "link" && !!parseInstagramUrl(m.url));
}

function EntryInstagrams({ posts }: { posts: MediaItem[] }) {
  return (
    <div className="entry__instas">
      {posts.map((m, i) => {
        const ig = parseInstagramUrl(m.url);
        return ig ? (
          <iframe
            key={i}
            className="entry__insta"
            src={ig.embedUrl}
            title="Instagram post"
            loading="lazy"
            scrolling="no"
            allowFullScreen
          />
        ) : (
          <a key={i} className="entry__link-card" href={m.url} target="_blank" rel="noopener noreferrer">
            <span className="entry__link-card__copy">
              <span className="entry__link-card__title">View this post on Instagram</span>
              <span className="entry__link-card__site">instagram.com ↗</span>
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
        {h.sourceUrl && (
          <a className="entry__source" href={h.sourceUrl} target="_blank" rel="noopener noreferrer" title="source for this entry">
            source ↗
          </a>
        )}
      </div>
      <h2 className="entry__title">
        <EntryIcon h={h} />
        <span className="entry__title__text">{h.title}</span>
      </h2>
      {h.body && <p className="entry__body">{h.body}</p>}
      {h.media.some((m) => m.kind === "image" || m.kind === "video") && (
        <EntryPhotos media={h.media.filter((m) => m.kind === "image" || m.kind === "video")} eventTitle={h.title} />
      )}
      {h.media.some((m) => m.kind === "link" && !isInstaMedia(m)) && (
        <EntryLinks links={h.media.filter((m) => m.kind === "link" && !isInstaMedia(m))} />
      )}
      {h.media.some((m) => m.kind === "tweet") && (
        <EntryTweets tweets={h.media.filter((m) => m.kind === "tweet")} />
      )}
      {h.media.some(isInstaMedia) && (
        <EntryInstagrams posts={h.media.filter(isInstaMedia)} />
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
type SortKey = DefaultView;
const SORTS: { v: SortKey; label: string }[] = [
  { v: "newest", label: "newest" },
  { v: "oldest", label: "oldest" },
  { v: "curated", label: "curated" },
];

// ---------- ROOT ----------
export default function Portfolio({ profile, chatEnabled, loggedIn, previewMode, claimContact }: { profile: ProfileDTO; chatEnabled?: boolean; loggedIn?: boolean; previewMode?: boolean; claimContact?: string }) {
  // The owner's saved theme (from the DB) is authoritative. The floating
  // picker only sets an in-session preview override (derived, no effect), so
  // it never overrides the saved default on the next load.
  const [preview, setPreview] = useState<{ palette?: string; layout?: string }>({});
  const [filter, setFilter] = useState(() =>
    profile.events.some((e) => e.featured) ? "highlights" : "all"
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // ask suggestions: log-derived seeds until a conversation happens, then the
  // model's own follow-ups take over the launcher for the rest of the visit
  const askSeeds = useMemo(() => seedQuestions(profile), [profile]);
  const [liveAsk, setLiveAsk] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // open on the owner's preferred order; falls back to "newest" by default.
  const [sort, setSort] = useState<SortKey>(profile.theme.defaultView ?? "newest");

  // scroll-collapse: as the profile card scrolls out, it's replaced by a compact
  // strip docked just below the top bar, in the card's exact place, showing the
  // avatar + the year/title currently being read. Progress is how much of the card
  // has scrolled above the top (0 → 1, clamped) so the strip stays pinned after.
  const heroRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const heroProgress = useMotionValue(0);
  useEffect(() => {
    if (previewMode) return;
    const el = heroRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const h = r.height || 1;
      heroProgress.set(Math.min(1, Math.max(0, -r.top / h)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [heroProgress]);
  // measure where the profile card sits (left/width) and how tall the bar is, so
  // the strip can dock in the card's exact place just below the bar. Horizontal
  // position only changes on resize/layout, so this isn't tied to scroll.
  const [miniBox, setMiniBox] = useState({ left: 0, width: 0, top: 56 });
  useEffect(() => {
    if (previewMode) return;
    const measure = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      const barH = barRef.current?.getBoundingClientRect().height ?? 52;
      setMiniBox({ left: Math.round(r.left), width: Math.round(r.width), top: Math.round(barH) });
    };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 300); // re-measure after fonts/layout settle
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  }, []);
  // slide down from under the bar + fade + grow from a touch small
  const miniY = useTransform(heroProgress, [0.4, 0.82], ["-100%", "0%"]);
  const miniOpacity = useTransform(heroProgress, [0.4, 0.82], [0, 1]);
  const miniScale = useTransform(heroProgress, [0.4, 0.82], [0.92, 1]);
  const [collapsed, setCollapsed] = useState(false);
  useMotionValueEvent(heroProgress, "change", (v) => setCollapsed(v > 0.5));

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
    if (previewMode) return;
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

  const theme: Theme = { palette, layout, accentOverride: profile.theme.accentOverride, defaultView: profile.theme.defaultView };
  const vars = themeCssVars(theme) as CSSProperties;

  const sinceYear = useMemo(
    () => (profile.events.length ? Math.min(...profile.events.map((e) => e.year)) : null),
    [profile.events]
  );

  // newest 7, for the OG-card "recent" rail in the profile header
  const recentEvents = useMemo(
    () => [...profile.events].sort((a, b) => dateKey(b).localeCompare(dateKey(a))).slice(0, 7),
    [profile.events]
  );

  // the entry the scroll-spy currently highlights — drives the docked strip's
  // year + title; falls back to the newest entry before the spy kicks in.
  const activeEntry = useMemo(
    () => profile.events.find((e) => e.id === activeId) ?? recentEvents[0] ?? null,
    [activeId, profile.events, recentEvents]
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
      | { type: "year"; year: number; key: string }
      | { type: "entry"; h: EventDTO; recency: string }
    > = [];
    let last: number | null = null;
    visible.forEach(({ h, recency }) => {
      if (h.year !== last) {
        // key by the entry that opens the group, not the year alone: in curated
        // order a year can recur, so `y-${year}` would collide and React would
        // strand stale year markers when re-keying on a sort switch.
        out.push({ type: "year", year: h.year, key: `y-${h.year}-${h.id}` });
        last = h.year;
      }
      out.push({ type: "entry", h, recency });
    });
    return out;
  }, [profile.events, filter, sort, chronoRank]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="logr" data-layout={layout} data-mode={PALETTES[palette]?.dark ? "dark" : "light"} style={vars} data-preview={previewMode ? "true" : undefined}>
        {/* unclaimed seeded profile — disclosure before anything else (Phase 3) */}
        {!previewMode && profile.claimStatus === "published" && (
          <SeededBanner name={profile.name} handle={profile.username} contact={claimContact ?? "hello@logr.it"} />
        )}
        {/* docked strip — replaces the profile card under the bar, tracking the
            year/title the reader is currently on (updates with the scroll-spy) */}
        {!previewMode && (
        <motion.header
          className="profile-mini"
          data-shown={collapsed}
          aria-hidden={!collapsed}
          style={{ top: miniBox.top, left: miniBox.left, width: miniBox.width, y: miniY, opacity: miniOpacity }}
        >
          <motion.div className="profile-mini__inner" style={{ scale: miniScale }}>
            <span className="profile-mini__avatar">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={profile.name} />
              ) : (
                <span className="profile-mini__initial">{firstLetter(profile.name)}</span>
              )}
            </span>
            {activeEntry && <span className="profile-mini__year">{activeEntry.date}</span>}
            <span className="profile-mini__title">{activeEntry?.title ?? profile.name}</span>
          </motion.div>
        </motion.header>
        )}
        {/* bar — full-width sticky, line spans the viewport (hidden in preview) */}
        {!previewMode && (
        <header className="bar" ref={barRef}>
          <div className="bar__inner">
            <span className="bar__brand"><Link href="/"><Mark />logr</Link></span>
            <nav className="bar__util" aria-label="utilities">
              {chatEnabled && (
                <span data-tour="ask" style={{ display: "inline-flex" }}>
                  <AskLauncher
                    name={profile.name}
                    suggestions={liveAsk.length > 0 ? liveAsk : askSeeds}
                    onAsk={(q) => { setPendingAsk(q); setChatOpen(true); }}
                  />
                </span>
              )}
              <button type="button" onClick={() => setShareOpen(true)} aria-label="share" data-tour="share">
                <svg className="bar__util__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                  <path d="M8 10V2.5M8 2.5L5.5 5M8 2.5L10.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 8v4.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" strokeLinecap="round" />
                </svg>
                <span className="bar__util__label">share</span>
              </button>
              {loggedIn && (
                <Link href="/dashboard" aria-label="dashboard" data-tour="dashboard">
                  <svg className="bar__util__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                    <rect x="2.5" y="2.5" width="4.6" height="4.6" rx="0.8" />
                    <rect x="8.9" y="2.5" width="4.6" height="4.6" rx="0.8" />
                    <rect x="2.5" y="8.9" width="4.6" height="4.6" rx="0.8" />
                    <rect x="8.9" y="8.9" width="4.6" height="4.6" rx="0.8" />
                  </svg>
                  <span className="bar__util__label">dashboard</span>
                </Link>
              )}
            </nav>
          </div>
        </header>
        )}
        <div className="page">
          {/* shell: sticky recent rail (left) + main column (right) */}
          <div className="shell">
            {/* recent — its own card, sticky in the left gutter */}
            <aside className="recent-card" aria-label="recent entries">
              <p className="recent-card__label">recent</p>
              {recentEvents.length > 0 ? (
                <ol className="recent-card__list">
                  {recentEvents.map((e, i) => {
                    const last = i === recentEvents.length - 1;
                    const size = RC_DOT_SIZES[i] ?? 4;
                    return (
                      <li key={e.id}>
                        <a className="rc" href={`#e-${e.id}`}>
                          <span className="rc__rail">
                            <span
                              className={`rc__dot${i === 0 ? " rc__dot--now" : ""}`}
                              style={{ width: size, height: size, opacity: RC_DOT_OPACITIES[i] ?? 0.3 }}
                            />
                            {!last && <span className="rc__line" />}
                          </span>
                          <span className="rc__text">
                            <span className="rc__date">{e.date}</span>
                            <span className="rc__title">
                              {e.icon && (isImageIcon(e.icon) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className="rc__ico" src={e.icon} alt="" />
                              ) : (
                                <span className="rc__ico rc__ico--emoji">{e.icon}</span>
                              ))}
                              <span className="rc__t">{e.title}</span>
                            </span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="recent-card__empty">no entries yet</p>
              )}
            </aside>

            {/* main column */}
            <div className="col">
              {/* profile — same width as the timeline */}
              <section className="profile" ref={heroRef}>
                <div className="profile__card">
                  <div className="profile__main">
                <p className="profile__handle">
                  logr.it<span className="accent">/</span>{profile.username}
                </p>

                {/* polaroid + name, inline */}
                <div className="profile__id">
                  <span className="profile__polaroid" aria-hidden={!profile.avatarUrl}>
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt={profile.name} />
                    ) : (
                      <span className="profile__polaroid__initial">{firstLetter(profile.name)}</span>
                    )}
                  </span>
                  <h1 className="profile__name">{profile.name}<span className="profile__caret" aria-hidden="true" /></h1>
                </div>

                {profile.bio && <p className="profile__bio">{profile.bio.replace(/\n/g, " ")}</p>}

                <dl className="profile__meta">
                  {sinceYear && (<><dt>since</dt><dd>{sinceYear}</dd></>)}
                  {profile.location && (<><dt>place</dt><dd>{profile.location}</dd></>)}
                  {profile.socials.length > 0 && (
                    <>
                      <dt>elsewhere</dt>
                      <dd className="profile__socials">
                        {profile.socials.map((s) => {
                          const platform = detectPlatform(s.href);
                          const icon = SOCIAL_ICONS[platform] ?? SOCIAL_ICONS[s.label.toLowerCase()];
                          const label = s.label || platform;
                          return (
                            <a
                              key={s.href}
                              href={s.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={icon ? "profile__social" : undefined}
                              aria-label={label}
                              title={label}
                            >
                              {icon ?? label.toLowerCase()}
                            </a>
                          );
                        })}
                      </dd>
                    </>
                  )}
                </dl>

                {/* footer: now / status */}
                {profile.status && (
                  <div className="profile__foot">
                    <div className="profile__now">
                      <span className="now__label">now /</span>
                      <span className="now__body">{profile.status}</span>
                    </div>
                  </div>
                )}
                  </div>
                </div>
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
                <div className="year" key={row.key}>
                  <span className="year__label">{row.year}</span>
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
            <span className="brand"><Mark />logr — just logr it.</span>
            <span>read by humans <span className="accent">·</span> ingested by machines</span>
          </footer>
            </div>
          </div>
        </div>

        {!previewMode && <Picker palette={palette} layout={layout} onPalette={pickPalette} onLayout={pickLayout} />}
        {!previewMode && chatEnabled && (
          <ChatWidget
            username={profile.username}
            name={profile.name}
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            ask={pendingAsk}
            onAskHandled={() => setPendingAsk(null)}
            suggestions={askSeeds}
            onSuggestions={setLiveAsk}
          />
        )}
        {!previewMode && <ShareModal username={profile.username} name={profile.name} open={shareOpen} onClose={() => setShareOpen(false)} />}
        {!previewMode && (
          <ProfileTour
            suggestions={liveAsk.length > 0 ? liveAsk : askSeeds}
            onAsk={chatEnabled ? (q) => { setPendingAsk(q); setChatOpen(true); } : undefined}
          />
        )}
      </div>
    </MotionConfig>
  );
}
