"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

/** Starter prompts shown on the empty state. Grounded, person-agnostic. */
function defaultSuggestions(first: string): string[] {
  return [
    `what is ${first} building now?`,
    "what have they shipped recently?",
    "what's their background?",
  ];
}

/**
 * The grounded-chat conversation: message list, streaming send, empty-state
 * starter prompts, and the input form. Deliberately renders no chrome of its
 * own (no scrim, no header) so it can be dropped into either the modal
 * (`ChatWidget`) or the standalone `/[username]/ask` page — both share this
 * one implementation and the same `/api/[username]/chat` route.
 */
export function ChatPanel({
  username,
  name,
  variant = "modal",
  autoFocus = true,
  active = true,
  suggestions,
}: {
  username: string;
  name: string;
  variant?: "modal" | "page";
  autoFocus?: boolean;
  /** kept in sync so the modal re-scrolls when it (re)opens */
  active?: boolean;
  suggestions?: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, active]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    if (!sessionRef.current) sessionRef.current = crypto.randomUUID();

    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`/api/${username}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionRef.current, messages: next }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong." }));
        setMessages((m) => replaceLast(m, err.error || "Sorry, something went wrong."));
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
      setMessages((m) => replaceLast(m, "Sorry, the connection dropped."));
    } finally {
      setStreaming(false);
    }
  }

  const first = name.split(" ")[0].toLowerCase();
  const prompts = suggestions ?? defaultSuggestions(first);

  return (
    <>
      <div className="ask__msgs" ref={scrollRef} data-variant={variant}>
        {messages.length === 0 ? (
          <div className="ask__empty">
            <p>ask anything about {name}&apos;s log — grounded only in what&apos;s recorded.</p>
            <div className="ask__suggest">
              {prompts.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            if (m.role === "user") {
              return <div key={i} className="ask__msg ask__msg--user">{m.content}</div>;
            }
            const { text, images } = splitContent(m.content);
            const loading = streaming && i === messages.length - 1 && !m.content;
            return (
              <div key={i} className="ask__msg ask__msg--assistant">
                {loading ? (
                  <span className="ask__thinking">
                    <span className="ask__dots3"><span /><span /><span /></span>
                    <span className="ask__thinking__text">thinking it over</span>
                  </span>
                ) : text}
                {images.length > 0 && (
                  <div className="ask__imgs">
                    {images.map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" loading="lazy" /></a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <form className="ask__form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`ask about ${first}…`}
          maxLength={1500}
          autoFocus={autoFocus}
          aria-label="your question"
        />
        <button type="submit" disabled={!input.trim() || streaming} aria-label="send">→</button>
      </form>
    </>
  );
}

/** Pull image URLs (markdown images + bare image links) out of an answer so
 *  they render as inline pictures, leaving the prose clean. */
function splitContent(content: string): { text: string; images: string[] } {
  const images: string[] = [];
  let text = content.replace(/!\[[^\]]*\]\(\s*(\S+?)\s*\)/g, (_m, u: string) => {
    images.push(u);
    return "";
  });
  text = text.replace(/(https?:\/\/\S+?\.(?:png|jpe?g|webp|gif|avif)(?:\?\S*)?)/gi, (u) => {
    images.push(u);
    return "";
  });
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, images: Array.from(new Set(images)) };
}

function replaceLast(m: Msg[], content: string): Msg[] {
  const c = [...m];
  if (c.length) c[c.length - 1] = { role: "assistant", content };
  return c;
}
