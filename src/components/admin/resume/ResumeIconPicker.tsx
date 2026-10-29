"use client";

import { useEffect, useRef, useState } from "react";
import { ResumeIcon } from "@/components/resume/ResumeIcon";
import { EMOJI_ICONS, LUCIDE_KEYS } from "@/components/resume/icons";
import { LUCIDE_PREFIX } from "@/lib/resume-format";

/** A small popover: curated Lucide set, emoji set, or any typed glyph. */
export function ResumeIconPicker({ value, onChange, size = 28, title = "icon" }: { value: string | null; onChange: (icon: string | null) => void; size?: number; title?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"lucide" | "emoji">(value?.startsWith(LUCIDE_PREFIX) || !value ? "lucide" : "emoji");
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function pick(icon: string | null) {
    onChange(icon);
    setOpen(false);
  }

  return (
    <div className="rsb-picker" ref={ref}>
      <button
        type="button"
        className="rsb-ibtn rsb-ibtn--pick"
        style={{ width: size, height: size }}
        onClick={() => setOpen((o) => !o)}
        aria-label={`${title}: ${value ?? "none"}`}
        aria-expanded={open}
        title={title}
      >
        {value ? <ResumeIcon icon={value} size={Math.round(size * 0.55)} /> : <span style={{ color: "var(--faint)", fontSize: 14 }}>+</span>}
      </button>
      {open && (
        <div className="rsb-picker__pop" role="dialog" aria-label="choose an icon">
          <div className="rsb-picker__tabs">
            <button type="button" aria-current={tab === "lucide"} onClick={() => setTab("lucide")}>icons</button>
            <button type="button" aria-current={tab === "emoji"} onClick={() => setTab("emoji")}>emoji</button>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => pick(null)}>none</button>
          </div>
          <div className="rsb-picker__grid">
            {tab === "lucide"
              ? LUCIDE_KEYS.map((k) => {
                  const v = `${LUCIDE_PREFIX}${k}`;
                  return (
                    <button key={k} type="button" aria-current={value === v} onClick={() => pick(v)} title={k}>
                      <ResumeIcon icon={v} size={15} />
                    </button>
                  );
                })
              : EMOJI_ICONS.map((e) => (
                  <button key={e} type="button" aria-current={value === e} onClick={() => pick(e)}>
                    {e}
                  </button>
                ))}
          </div>
          <form
            className="rsb-picker__foot"
            onSubmit={(e) => { e.preventDefault(); if (custom.trim()) pick(custom.trim().slice(0, 300)); }}
          >
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="any emoji or image URL" aria-label="custom icon" />
            <button type="submit" className="btn btn--small">use</button>
          </form>
        </div>
      )}
    </div>
  );
}
