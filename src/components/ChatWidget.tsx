"use client";

import { useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";

/**
 * Modal shell for the grounded chat. The conversation itself lives in
 * `ChatPanel`, which the standalone `/[username]/ask` page also renders — the
 * two surfaces share one implementation. This component owns only the modal
 * chrome: scrim, header, Escape-to-close, and scroll locking.
 */
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

  if (!open) return null;

  return (
    <div className="ask__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ask__panel" role="dialog" aria-modal="true" aria-label={`ask about ${name}`}>
        <div className="ask__head">
          <span>ask <span className="accent">/</span> {name.toLowerCase()}</span>
          <a className="ask__expand" href={`/${username}/ask`} aria-label="open ask page" title="open as a full page">↗</a>
          <button onClick={onClose} aria-label="close">×</button>
        </div>
        <ChatPanel username={username} name={name} variant="modal" active={open} />
      </div>
    </div>
  );
}
