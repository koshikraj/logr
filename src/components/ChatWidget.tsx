"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { useSheetDrag } from "@/components/ui/useSheetDrag";
import { AgentAvatar } from "@/components/AgentAvatar";
import { ChatPanel } from "@/components/ChatPanel";

/**
 * The ask modal — a thin shell (scrim, sheet, header) around the shared
 * ChatPanel. The ⤢ header link expands to the dedicated /[username]/ask
 * page; the conversation follows via the panel's sessionStorage persistence.
 */
export function ChatWidget({
  username,
  name,
  open,
  onClose,
  ask,
  onAskHandled,
  suggestions,
  onSuggestions,
}: {
  username: string;
  name: string;
  open: boolean;
  onClose: () => void;
  /** a question handed in from the launcher — sent automatically on open */
  ask?: string | null;
  onAskHandled?: () => void;
  /** log-derived seed questions (lib/suggest.ts); also the chip fallback */
  suggestions?: string[];
  /** reports the model's follow-ups upward (they feed the ask launcher) */
  onSuggestions?: (qs: string[]) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const viewerOpenRef = useRef(false);
  useSheetDrag(panelRef, onClose, open); // phones: swipe the sheet down to dismiss

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // the Lightbox owns Escape while it's up
      if (e.key === "Escape" && !viewerOpenRef.current) onClose();
    };
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
      <div className="ask__panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`ask about ${name}`}>
        <div className="ask__head">
          <span className="ask__head__brand">
            <AgentAvatar state="idle" size={14} />
            ask <span className="accent">/</span> {name.toLowerCase()}
          </span>
          <Link
            className="ask__expand"
            href={`/${username}/ask`}
            aria-label="open as full page"
            title="open as full page"
          >
            ⤢
          </Link>
          <button onClick={onClose} aria-label="close">×</button>
        </div>
        <ChatPanel
          username={username}
          name={name}
          ask={ask}
          onAskHandled={onAskHandled}
          suggestions={suggestions}
          onSuggestions={onSuggestions}
          onViewerOpenChange={(v) => { viewerOpenRef.current = v; }}
        />
      </div>
    </div>
  );
}
