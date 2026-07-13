"use client";

import { useState, useEffect, useRef } from "react";
import { useSheetDrag } from "@/components/ui/useSheetDrag";

export function ShareModal({
  username,
  name,
  open,
  onClose,
  withAsk,
}: {
  username: string;
  name: string;
  open: boolean;
  onClose: () => void;
  /** also offer the /ask chat link (used on the dedicated ask page) */
  withAsk?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useSheetDrag(cardRef, onClose, open); // phones: swipe the sheet down to dismiss

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/${username}`;
  const agentUrl = `${pageUrl}/llm.txt`;
  const examplePrompt = `Read ${agentUrl} and tell me about ${name} — their background, what they're building now, and anything notable.`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  const label = (key: string, base = "copy") => (copied === key ? "copied ✓" : base);

  return (
    <div className="share__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="share" ref={cardRef} role="dialog" aria-modal="true" aria-label={`share ${name}'s log`}>
        <div className="share__head">
          <span>share <span className="accent">/</span> {name.toLowerCase()}</span>
          <button onClick={onClose} aria-label="close">×</button>
        </div>

        <div className="share__body">
          <div className="share__block">
            <span className="share__label">for people</span>
            <div className="share__row">
              <input readOnly value={pageUrl} onFocus={(e) => e.currentTarget.select()} aria-label="page link" />
              <button type="button" onClick={() => copy(pageUrl, "page")}>{label("page")}</button>
            </div>
            <p className="share__note">a timeline anyone can read.</p>
          </div>

          {withAsk && (
            <div className="share__block">
              <span className="share__label">for questions <span className="accent">·</span> ask</span>
              <div className="share__row">
                <input readOnly value={`${pageUrl}/ask`} onFocus={(e) => e.currentTarget.select()} aria-label="ask link" />
                <button type="button" onClick={() => copy(`${pageUrl}/ask`, "ask")}>{label("ask")}</button>
              </div>
              <p className="share__note">a live chat grounded in the log — anyone can ask.</p>
            </div>
          )}

          <div className="share__block">
            <span className="share__label">for agents <span className="accent">·</span> ai</span>
            <div className="share__row">
              <input readOnly value={agentUrl} onFocus={(e) => e.currentTarget.select()} aria-label="agent link" />
              <button type="button" onClick={() => copy(agentUrl, "agent")}>{label("agent")}</button>
            </div>
            <p className="share__note">a structured <span className="accent">llm.txt</span> any AI can ingest. paste this into ChatGPT or Claude:</p>
            <div className="share__prompt">
              <code>{examplePrompt}</code>
              <button type="button" onClick={() => copy(examplePrompt, "prompt")}>{label("prompt", "copy prompt")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
