"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget({
  username,
  name,
  open,
  onClose,
}: {
  username: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const q = input.trim();
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

  if (!open) return null;
  const first = name.split(" ")[0].toLowerCase();

  return (
    <div className="ask__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ask__panel" role="dialog" aria-modal="true" aria-label={`ask about ${name}`}>
        <div className="ask__head">
          <span>ask <span className="accent">/</span> {name.toLowerCase()}</span>
          <button onClick={onClose} aria-label="close">×</button>
        </div>
        <div className="ask__msgs" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="ask__empty">
              <p>ask anything about {name}&apos;s log — grounded only in what&apos;s recorded.</p>
              <div className="ask__suggest">
                {[`what is ${first} building now?`, "what have they shipped?", "what's their background?"].map((s) => (
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
          {messages.length > 0 && <div ref={spacerRef} aria-hidden="true" style={{ flexShrink: 0 }} />}
        </div>
        <form className="ask__form" onSubmit={send}>
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
      </div>
    </div>
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
