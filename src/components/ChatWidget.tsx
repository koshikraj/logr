"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence } from "framer-motion";
import { useSheetDrag } from "@/components/ui/useSheetDrag";
import { Lightbox } from "@/components/ui/Lightbox";
import { SOCIAL_ICONS } from "@/components/social-icons";
import { detectPlatform } from "@/lib/socials";
import type { MediaItem } from "@/lib/profile";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };
type ChatLink = { label: string; href: string };

// Markdown → the ask panel's design language. Images are extracted into the
// filmstrip before rendering, links open safely, headings demote to lead-ins
// (an answer is prose, not a document).
const MD_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  img: () => null,
  h1: ({ children }) => <p className="ask__md__h">{children}</p>,
  h2: ({ children }) => <p className="ask__md__h">{children}</p>,
  h3: ({ children }) => <p className="ask__md__h">{children}</p>,
  h4: ({ children }) => <p className="ask__md__h">{children}</p>,
};

export function ChatWidget({
  username,
  name,
  open,
  onClose,
  ask,
  onAskHandled,
}: {
  username: string;
  name: string;
  open: boolean;
  onClose: () => void;
  /** a question handed in from the launcher — sent automatically on open */
  ask?: string | null;
  onAskHandled?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const sessionRef = useRef("");
  const lastQRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  useSheetDrag(panelRef, onClose, open); // phones: swipe the sheet down to dismiss

  // When a question is sent, pin it to the top of the window and reserve room
  // below for the answer — then leave the scroll alone while it streams.
  useEffect(() => {
    const c = scrollRef.current;
    const added = messages.length > prevCount.current;
    prevCount.current = messages.length;
    if (!c || !added) return;
    const el = lastUserRef.current;
    if (!el) return;
    if (spacerRef.current) {
      spacerRef.current.style.height = `${Math.max(0, c.clientHeight - el.offsetHeight - 100)}px`;
    }
    c.scrollTo({
      top: c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - 16,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // the Lightbox owns Escape while it's up
      if (e.key === "Escape" && !viewerRef.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // a question handed in from the launcher: send it once, then let the
  // parent clear it (the ref guards dev double-invoked effects)
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !ask) { askedRef.current = null; return; }
    if (askedRef.current === ask) return;
    askedRef.current = ask;
    void send(ask);
    onAskHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ask]);

  async function send(raw: string, base?: Msg[]) {
    const q = raw.trim();
    if (!q || streaming) return;
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();
    lastQRef.current = q;

    const next: Msg[] = [...(base ?? messages), { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`/api/${username}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionRef.current,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong." }));
        setMessages((m) => replaceLast(m, err.error || "Sorry, something went wrong.", true));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => replaceLast(m, acc));
      }
    } catch {
      setMessages((m) => replaceLast(m, "Sorry, the connection dropped.", true));
    } finally {
      setStreaming(false);
    }
  }

  /** drop the failed user/answer pair and resend the same question */
  function retry() {
    if (!lastQRef.current || streaming) return;
    void send(lastQRef.current, messages.slice(0, -2));
  }

  function copyAnswer(i: number, content: string) {
    navigator.clipboard?.writeText(content).then(
      () => {
        setCopied(i);
        setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
      },
      () => {}
    );
  }

  if (!open) return null;
  const first = name.split(" ")[0].toLowerCase();
  const suggestions = [`what is ${first} building now?`, "what have they shipped?", "what's their background?"];
  const followups = suggestions.filter(
    (s) => !messages.some((m) => m.role === "user" && m.content.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="ask__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ask__panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`ask about ${name}`}>
        <div className="ask__head">
          <span>ask <span className="accent">/</span> {name.toLowerCase()}</span>
          <button onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="ask__msgs" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="ask__empty">
              <p>ask anything about {name}&apos;s log — grounded only in what&apos;s recorded.</p>
              <div className="ask__suggest">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => setInput(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              if (m.role === "user") {
                const isLastUser = i === messages.length - 2 || i === messages.length - 1;
                return <div key={i} ref={isLastUser ? lastUserRef : undefined} className="ask__msg ask__msg--user">{m.content}</div>;
              }
              const isLast = i === messages.length - 1;
              const streamingThis = streaming && isLast;
              const loading = streamingThis && !m.content;
              const { text, images, links } = parseAnswer(m.content, streamingThis);
              return (
                <div key={i} className="ask__msg ask__msg--assistant">
                  {loading ? (
                    <span className="ask__thinking">
                      <span className="ask__dots3"><span /><span /><span /></span>
                      <span className="ask__thinking__text">thinking it over</span>
                    </span>
                  ) : m.error ? (
                    <>
                      <p className="ask__error">{text}</p>
                      <div className="ask__actions">
                        <button className="ask__action" onClick={retry}>↻ try again</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ask__md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                          {text}
                        </ReactMarkdown>
                        {streamingThis && <span className="ask__caret" aria-hidden="true" />}
                      </div>
                      {links.length > 0 && (
                        <div className="ask__links">
                          {links.map((l) => {
                            const platform = detectPlatform(l.href);
                            const icon = SOCIAL_ICONS[platform] ?? SOCIAL_ICONS.link;
                            // a hostname label on a recognized platform reads
                            // better as the platform's own name
                            const label =
                              SOCIAL_ICONS[platform] && l.label.includes(".") ? platform : l.label;
                            return (
                              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" title={l.href}>
                                {icon}
                                <span className="ask__links__label">{label}</span>
                                <span className="ask__links__arrow" aria-hidden="true">↗</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {images.length > 0 && (
                        <div className="ask__imgs">
                          {images.map((u, idx) => (
                            <button
                              key={u}
                              onClick={() => setViewer({ items: images.map(toMedia), index: idx })}
                              aria-label="view image"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                      {!streamingThis && m.content && (
                        <div className="ask__actions">
                          <button className="ask__action" onClick={() => copyAnswer(i, m.content)}>
                            {copied === i ? "✓ copied" : "⧉ copy"}
                          </button>
                        </div>
                      )}
                      {!streaming && isLast && followups.length > 0 && (
                        <div className="ask__followups">
                          {followups.slice(0, 2).map((s) => (
                            <button key={s} onClick={() => void send(s)}>{s}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
          {messages.length > 0 && <div ref={spacerRef} aria-hidden="true" style={{ flexShrink: 0 }} />}
        </div>
        <form className="ask__form" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`ask about ${first}…`}
            maxLength={1500}
            autoFocus
            aria-label="your question"
          />
          <button type="submit" disabled={!input.trim() || streaming} aria-label="send">→</button>
        </form>
        <AnimatePresence>
          {viewer && <Lightbox items={viewer.items} startIndex={viewer.index} onClose={() => setViewer(null)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

const toMedia = (url: string): MediaItem => ({ kind: "image", url, poster: null, provider: null, title: null });

const IMG_EXT = /\.(?:png|jpe?g|webp|gif|avif)(?:\?\S*)?$/i;

/** Split a (possibly still streaming) answer into prose, gallery images and
 *  reference links. Images leave the text entirely; links stay inline AND
 *  are collected for the chip row. Mid-stream, unfinished markdown (a
 *  half-typed link, an unclosed **bold**) is patched so it never flashes
 *  as raw syntax. */
function parseAnswer(content: string, streaming: boolean): { text: string; images: string[]; links: ChatLink[] } {
  const images: string[] = [];
  const links: ChatLink[] = [];

  // markdown images + bare image URLs → filmstrip
  let text = content.replace(/!\[[^\]]*\]\(\s*(\S+?)\s*\)/g, (_m, u: string) => {
    images.push(u);
    return "";
  });
  text = text.replace(/(https?:\/\/\S+?\.(?:png|jpe?g|webp|gif|avif)(?:\?\S*)?)(?![^([]*[)\]])/gi, (u) => {
    images.push(u);
    return "";
  });

  // collect markdown links (kept inline in the prose)
  for (const m of text.matchAll(/\[([^\]]+)\]\(\s*(https?:\/\/[^)\s]+)\s*\)/g)) {
    if (!IMG_EXT.test(m[2])) links.push({ label: m[1], href: m[2] });
  }
  // bare URLs that aren't part of a markdown link → chip with the hostname
  const withoutMd = text.replace(/\[([^\]]+)\]\(\s*https?:\/\/[^)\s]+\s*\)/g, "$1");
  for (const m of withoutMd.matchAll(/https?:\/\/[^\s<>()"']+/g)) {
    const href = m[0].replace(/[.,;:!?]+$/, "");
    if (IMG_EXT.test(href)) continue;
    try {
      links.push({ label: new URL(href).hostname.replace(/^www\./, ""), href });
    } catch { /* not a URL after all */ }
  }

  if (streaming) {
    // drop a half-typed image/link at the stream tail, close an open **bold**
    text = text.replace(/!?\[[^\]]*(\]\([^)]*)?$/, "");
    if (text.split("**").length % 2 === 0) text += "**";
  }

  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const seen = new Set<string>();
  return {
    text,
    images: Array.from(new Set(images)),
    links: links.filter((l) => !seen.has(l.href) && seen.add(l.href)),
  };
}

function replaceLast(m: Msg[], content: string, error = false): Msg[] {
  const c = [...m];
  if (c.length) c[c.length - 1] = { role: "assistant", content, error };
  return c;
}
