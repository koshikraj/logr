"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence } from "framer-motion";
import { Lightbox } from "@/components/ui/Lightbox";
import { AgentAvatar } from "@/components/AgentAvatar";
import { SOCIAL_ICONS } from "@/components/social-icons";
import { detectPlatform } from "@/lib/socials";
import { parseVideoUrl } from "@/lib/video";
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

/**
 * The grounded chat itself — messages, streaming, markdown, link chips,
 * media filmstrip + Lightbox, follow-up suggestions, copy/retry — shared by
 * the modal (ChatWidget) and the dedicated /[username]/ask page. The
 * conversation persists to sessionStorage per profile, so it follows the
 * visitor between the two surfaces (and across the modal's unmounts).
 */
export function ChatPanel({
  username,
  name,
  ask,
  onAskHandled,
  suggestions: seedSuggestions,
  onSuggestions,
  onViewerOpenChange,
}: {
  username: string;
  name: string;
  /** a question handed in from the launcher — sent automatically on mount */
  ask?: string | null;
  onAskHandled?: () => void;
  /** log-derived seed questions (lib/suggest.ts); also the chip fallback */
  suggestions?: string[];
  /** reports the model's follow-ups upward (they feed the ask launcher) */
  onSuggestions?: (qs: string[]) => void;
  /** lets a modal host defer its Escape handling while the Lightbox is up */
  onViewerOpenChange?: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  // Synchronous source of truth for the thread. State updates flush later
  // than mount-effect order, so anything that builds on "current messages"
  // during mount (the launcher auto-ask racing the sessionStorage restore)
  // must read/write through this ref via apply() — never the closure state.
  const messagesRef = useRef<Msg[]>([]);
  const apply = (next: Msg[] | ((m: Msg[]) => Msg[])) => {
    messagesRef.current = typeof next === "function" ? next(messagesRef.current) : next;
    setMessages(messagesRef.current);
  };
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const sessionRef = useRef("");
  const lastQRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const hydrated = useRef(false);

  useEffect(() => {
    onViewerOpenChange?.(viewer !== null);
  }, [viewer, onViewerOpenChange]);

  // Restore the conversation for this profile (post-mount, so SSR markup
  // stays deterministic), then persist every change. A trailing empty
  // assistant bubble (closed mid-"thinking") is dropped on restore.
  const storageKey = `logr-ask:${username}`;
  useEffect(() => {
    // run-once: StrictMode re-invokes mount effects, and a second restore
    // would clobber a question the auto-ask already appended to the ref
    if (hydrated.current) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { sessionId?: string; messages?: Msg[] };
        sessionRef.current = saved.sessionId || "";
        const msgs = (saved.messages ?? []).filter(
          (m, i, a) => !(i === a.length - 1 && m.role === "assistant" && !m.content)
        );
        // setState-in-effect is deliberate: storage is client-only, so the
        // restore must happen after hydration (one extra render on mount)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (msgs.length && messagesRef.current.length === 0) apply(msgs);
      }
    } catch { /* fresh start */ }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated.current || messages.length === 0) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ sessionId: sessionRef.current, messages }));
    } catch { /* storage full/blocked — conversation just won't carry over */ }
  }, [messages, storageKey]);

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

  // a question handed in from the launcher: send it once, then let the
  // parent clear it (the ref guards dev double-invoked effects)
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ask) { askedRef.current = null; return; }
    if (askedRef.current === ask) return;
    askedRef.current = ask;
    void send(ask);
    onAskHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  async function send(raw: string, base?: Msg[]) {
    const q = raw.trim();
    if (!q || streaming) return;
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();
    lastQRef.current = q;

    const next: Msg[] = [...(base ?? messagesRef.current), { role: "user", content: q }];
    apply([...next, { role: "assistant", content: "" }]);
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
        apply((m) => replaceLast(m, err.error || "Sorry, something went wrong.", true));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        apply((m) => replaceLast(m, acc));
      }
      const { suggestions: dyn } = parseAnswer(acc, false);
      if (dyn.length) onSuggestions?.(dyn);
    } catch {
      apply((m) => replaceLast(m, "Sorry, the connection dropped.", true));
    } finally {
      setStreaming(false);
    }
  }

  /** drop the failed user/answer pair and resend the same question */
  function retry() {
    if (!lastQRef.current || streaming) return;
    void send(lastQRef.current, messagesRef.current.slice(0, -2));
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

  const first = name.split(" ")[0].toLowerCase();
  const suggestions = seedSuggestions?.length
    ? seedSuggestions
    : [`what is ${first} up to right now?`, "what's the story so far?", "what's new recently?"];
  const followups = suggestions.filter(
    (s) => !messages.some((m) => m.role === "user" && m.content.toLowerCase() === s.toLowerCase())
  );

  return (
    <>
      <div className="ask__msgs" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ask__empty">
            <AgentAvatar state="idle" size={28} entrance className="agv-empty" />
            <p>ask anything about {name}&apos;s log — grounded only in what&apos;s recorded.</p>
            {/* tap = ask: pills submit straight away, same as follow-up chips */}
            <div className="ask__suggest">
              {suggestions.map((s) => (
                <button key={s} onClick={() => void send(s)}>{s}</button>
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
            const { text, gallery, links, suggestions: dynamicFollowups } = parseAnswer(m.content, streamingThis);
            // model-suggested follow-ups when it produced them, static otherwise
            const chips = dynamicFollowups.length > 0 ? dynamicFollowups : followups.slice(0, 2);
            return (
              <div key={i} className="ask__msg ask__msg--assistant">
                {loading ? (
                  <span className="agv-thinking" role="status" aria-label="thinking it over">
                    <AgentAvatar state="typing" size={22} />
                    <span className="agv-bubble"><span /><span /><span /></span>
                  </span>
                ) : m.error ? (
                  <>
                    <div className="agv-errrow">
                      <AgentAvatar state="confused" size={20} />
                      <p className="ask__error">{text}</p>
                    </div>
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
                    {gallery.length > 0 && (
                      <div className="ask__imgs">
                        {gallery.map((g, idx) => (
                          <button
                            key={g.url}
                            onClick={() => setViewer({ items: gallery, index: idx })}
                            aria-label={g.kind === "video" ? "play video" : "view image"}
                          >
                            {g.kind === "video" && !g.poster ? (
                              <span className="ask__imgs__vbg" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.kind === "video" ? g.poster! : g.url} alt="" loading="lazy" />
                            )}
                            {g.kind === "video" && (
                              <span className="ask__imgs__play" aria-hidden="true">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {!streamingThis && m.content && (
                      <div className="ask__actions">
                        <button className="ask__action" onClick={() => copyAnswer(i, text)}>
                          {copied === i ? "✓ copied" : "⧉ copy"}
                        </button>
                      </div>
                    )}
                    {!streaming && isLast && chips.length > 0 && (
                      <div className="ask__followups">
                        {chips.map((s) => (
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
        {/* no autoFocus: focusing on open pops the keyboard on phones */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`ask about ${first}…`}
          maxLength={1500}
          aria-label="your question"
        />
        <button type="submit" disabled={!input.trim() || streaming} aria-label="send">→</button>
      </form>
      <AnimatePresence>
        {viewer && <Lightbox items={viewer.items} startIndex={viewer.index} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </>
  );
}

const IMG_EXT = /\.(?:png|jpe?g|webp|gif|avif)(?:\?\S*)?$/i;

/** Recognize a video URL (incl. the youtube-nocookie embed URLs the log
 *  stores) and shape it for the Lightbox player. */
function toVideoItem(url: string): MediaItem | null {
  const nc = url.match(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (nc) {
    return {
      kind: "video",
      url: `https://www.youtube-nocookie.com/embed/${nc[1]}`,
      poster: `https://i.ytimg.com/vi/${nc[1]}/hqdefault.jpg`,
      provider: "youtube",
      title: null,
    };
  }
  const v = parseVideoUrl(url);
  return v ? { kind: "video", url: v.embedUrl, poster: v.poster, provider: v.provider, title: null } : null;
}

/** Split a (possibly still streaming) answer into prose, a media gallery
 *  (images + playable videos) and reference links. Media URLs leave the
 *  text entirely; links stay inline AND are collected for the chip row.
 *  Mid-stream, unfinished markdown (a half-typed link, an unclosed
 *  **bold**) is patched so it never flashes as raw syntax. */
function parseAnswer(
  content: string,
  streaming: boolean
): { text: string; gallery: MediaItem[]; links: ChatLink[]; suggestions: string[] } {
  const gallery: MediaItem[] = [];
  const links: ChatLink[] = [];
  const pushMedia = (url: string) => {
    gallery.push(toVideoItem(url) ?? { kind: "image", url, poster: null, provider: null, title: null });
  };

  // the model's final `>>> q1 | q2 | q3` line → follow-up suggestion chips
  let suggestions: string[] = [];
  let text = content.replace(/\n?^\s*>{3}\s*([^\n]+)\s*$/m, (_m, line: string) => {
    suggestions = line.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3);
    return "";
  });

  // markdown images + bare image/video URLs → gallery
  text = text.replace(/!\[[^\]]*\]\(\s*(\S+?)\s*\)/g, (_m, u: string) => {
    pushMedia(u);
    return "";
  });
  text = text.replace(/(https?:\/\/\S+?\.(?:png|jpe?g|webp|gif|avif)(?:\?\S*)?)(?![^([]*[)\]])/gi, (u) => {
    pushMedia(u);
    return "";
  });

  // collect markdown links; video hrefs also get a playable gallery tile
  for (const m of text.matchAll(/\[([^\]]+)\]\(\s*(https?:\/\/[^)\s]+)\s*\)/g)) {
    if (IMG_EXT.test(m[2])) continue;
    if (toVideoItem(m[2])) pushMedia(m[2]);
    else links.push({ label: m[1], href: m[2] });
  }
  // bare URLs that aren't part of a markdown link: videos → gallery,
  // the rest → chip with the hostname
  const withoutMd = text.replace(/\[([^\]]+)\]\(\s*https?:\/\/[^)\s]+\s*\)/g, "$1");
  for (const m of withoutMd.matchAll(/https?:\/\/[^\s<>()"']+/g)) {
    const href = m[0].replace(/[.,;:!?]+$/, "");
    if (IMG_EXT.test(href)) continue;
    if (toVideoItem(href)) {
      pushMedia(href);
      text = text.replace(href, "");
      continue;
    }
    try {
      links.push({ label: new URL(href).hostname.replace(/^www\./, ""), href });
    } catch { /* not a URL after all */ }
  }

  if (streaming) {
    // drop a half-typed image/link/suggestion-line at the stream tail,
    // close an open **bold**
    text = text.replace(/!?\[[^\]]*(\]\([^)]*)?$/, "");
    text = text.replace(/\n\s*>{1,3}[^\n]*$/, "");
    if (text.split("**").length % 2 === 0) text += "**";
  }

  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const seenMedia = new Set<string>();
  const seenLinks = new Set<string>();
  return {
    text,
    gallery: gallery.filter((g) => !seenMedia.has(g.url) && seenMedia.add(g.url)),
    links: links.filter((l) => !seenLinks.has(l.href) && seenLinks.add(l.href)),
    suggestions,
  };
}

function replaceLast(m: Msg[], content: string, error = false): Msg[] {
  const c = [...m];
  if (c.length) c[c.length - 1] = { role: "assistant", content, error };
  return c;
}
