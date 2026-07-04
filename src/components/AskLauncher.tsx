"use client";

import { useState, useRef, useEffect } from "react";
import { TypingLabel } from "@/components/TypingLabel";

/** The top-bar "ask" affordance. Collapsed, it's an accent pill that types
 *  through the suggested questions. Clicked, it morphs in place into a wider
 *  input bar with the suggestions as a dropdown beneath. Submitting (typed
 *  or picked) hands the question to the chat window via onAsk. */
export function AskLauncher({ name, onAsk }: { name: string; onAsk: (q: string) => void }) {
  const first = name.split(" ")[0].toLowerCase();
  const suggestions = [
    `what is ${first} building now?`,
    "what have they shipped?",
    "what's their background?",
  ];
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // expanded: focus the input; collapse on outside click or Escape
  useEffect(() => {
    if (!expanded) return;
    inputRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  function submit(q: string) {
    const t = q.trim();
    if (!t) return;
    setExpanded(false);
    setValue("");
    onAsk(t);
  }

  const robot = (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <rect x="3" y="5.5" width="10" height="7.6" rx="2.2" />
      <circle cx="6.1" cy="9.3" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="9.9" cy="9.3" r="0.95" fill="currentColor" stroke="none" />
      <line x1="8" y1="3" x2="8" y2="5.5" strokeLinecap="round" />
      <circle cx="8" cy="2.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );

  return (
    <div className={`ask-launch${expanded ? " is-open" : ""}`} ref={wrapRef}>
      {/* collapsed pill — rotating suggestion as the label */}
      <button
        type="button"
        className="ask-launch__btn"
        onClick={() => setExpanded(true)}
        aria-expanded={expanded}
        aria-label={`ask about ${name}`}
        tabIndex={expanded ? -1 : 0}
      >
        {robot}
        <span className="ask-launch__hint" aria-hidden="true">
          <TypingLabel phrases={suggestions} />
        </span>
      </button>

      {/* expanded input bar — same box, crossfaded in as the pill widens */}
      <form
        className="ask-launch__form"
        onSubmit={(e) => { e.preventDefault(); submit(value); }}
        aria-hidden={!expanded}
      >
        {robot}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`ask about ${first}…`}
          maxLength={1500}
          tabIndex={expanded ? 0 : -1}
          aria-label="your question"
        />
        <button type="submit" disabled={!value.trim()} tabIndex={expanded ? 0 : -1} aria-label="ask">→</button>
      </form>

      {/* suggestions drop under the bar */}
      <div className="ask-launch__drop" role="listbox" aria-hidden={!expanded}>
        {suggestions.map((s) => (
          <button key={s} type="button" role="option" aria-selected="false" tabIndex={expanded ? 0 : -1} onClick={() => submit(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
