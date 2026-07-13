"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
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
import { detectPlatform } from "@/lib/socials";
import { Lightbox } from "@/components/ui/Lightbox";
import { Mark } from "@/components/Mark";
import { LAYOUT_ICONS } from "@/components/layout-icons";
import { ChatWidget } from "@/components/ChatWidget";
import { ShareModal } from "@/components/ShareModal";
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
  instagram: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
  ),
  youtube: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
  ),
  telegram: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
  ),
  whatsapp: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
  ),
  calendly: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round" /></svg>
  ),
  peerlist: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C2.667 0 0 2.667 0 12s2.673 12 12 12 12-2.667 12-12S21.327 0 12 0zm8.892 20.894c-1.57 1.569-4.247 2.249-8.892 2.249s-7.322-.68-8.892-2.25C1.735 19.522 1.041 17.3.89 13.654A39.74 39.74 0 0 1 .857 12c0-1.162.043-2.201.13-3.13.177-1.859.537-3.278 1.106-4.366.284-.544.62-1.006 1.013-1.398s.854-.729 1.398-1.013C5.592 1.524 7.01 1.164 8.87.988 9.799.9 10.838.858 12 .858c4.645 0 7.322.68 8.892 2.248 1.569 1.569 2.25 4.246 2.25 8.894s-.681 7.325-2.25 8.894zM20.538 3.46C19.064 1.986 16.51 1.357 12 1.357c-4.513 0-7.067.629-8.54 2.103C1.986 4.933 1.357 7.487 1.357 12c0 4.511.63 7.065 2.105 8.54C4.936 22.014 7.49 22.643 12 22.643s7.064-.629 8.538-2.103c1.475-1.475 2.105-4.029 2.105-8.54s-.63-7.065-2.105-8.54zM14.25 16.49a6.097 6.097 0 0 1-2.442.59v2.706H10.45v.357H6.429V5.57h.357V4.214h5.676c3.565 0 6.467 2.81 6.467 6.262 0 2.852-1.981 5.26-4.68 6.013zm-1.788-8.728H10.45v5.428h2.011c1.532 0 2.802-1.2 2.802-2.714s-1.27-2.714-2.802-2.714zm.901 4.351c.117-.239.186-.502.186-.78 0-1.01-.855-1.857-1.945-1.857h-.296V8.62h1.154c1.09 0 1.945.847 1.945 1.857 0 .705-.422 1.323-1.044 1.637zm4.104 1.493c.043-.063.083-.129.123-.194a5.653 5.653 0 0 0 .526-1.103 5.56 5.56 0 0 0 .11-.362c.02-.076.042-.15.06-.227a5.58 5.58 0 0 0 .073-.41c.01-.068.025-.134.032-.203.024-.207.038-.417.038-.63 0-3.198-2.687-5.763-5.967-5.763H7.286v14.572h4.022v-3.048h1.154c1.43 0 2.747-.488 3.778-1.303a5.92 5.92 0 0 0 .46-.406c.035-.034.066-.07.1-.105.107-.11.21-.22.308-.337.044-.053.084-.108.126-.162.081-.104.16-.21.233-.319z" /></svg>
  ),
  topmate: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm0 10.5 5.09-3.18a6 6 0 1 0 0 6.36L12 12Z" /></svg>
  ),
  "dev.to": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z" /></svg>
  ),
  producthunt: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.801 0-.993-.805-1.799-1.801-1.799zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.801V6h5.804c2.319 0 4.2 1.88 4.2 4.199 0 2.321-1.881 4.201-4.201 4.201z" /></svg>
  ),
  patreon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" /></svg>
  ),
  "daily.dev": (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.29 5.706a1.405 1.405 0 0 0-1.987 0L4.716 17.296l1.324-2.65-2.65-2.649 3.312-3.311 2.65 2.65 1.986-1.988-3.642-3.642a1.405 1.405 0 0 0-1.987 0L.411 11.004a1.404 1.404 0 0 0 0 1.987l4.305 4.304.993.993a1.405 1.405 0 0 0 1.987 0L19.285 6.7l-.993-.994Zm-.332 3.647 2.65 2.65-4.306 4.305a1.404 1.404 0 1 0 1.986 1.986l5.299-5.298a1.404 1.404 0 0 0 0-1.987l-4.305-4.304-1.324 2.648Z" /></svg>
  ),
  email: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67ZM22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" /></svg>
  ),
  link: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z" /></svg>
  ),
};

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
                <AskLauncher
                  name={profile.name}
                  onAsk={(q) => { setPendingAsk(q); setChatOpen(true); }}
                />
              )}
              <button type="button" onClick={() => setShareOpen(true)} aria-label="share">
                <svg className="bar__util__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                  <path d="M8 10V2.5M8 2.5L5.5 5M8 2.5L10.5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 8v4.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8" strokeLinecap="round" />
                </svg>
                <span className="bar__util__label">share</span>
              </button>
              {loggedIn && (
                <Link href="/dashboard" aria-label="dashboard">
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
          />
        )}
        {!previewMode && <ShareModal username={profile.username} name={profile.name} open={shareOpen} onClose={() => setShareOpen(false)} />}
      </div>
    </MotionConfig>
  );
}
