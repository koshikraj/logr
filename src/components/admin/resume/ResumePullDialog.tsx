"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { isImageIcon } from "@/lib/icon";
import { TAG_META } from "@/lib/theme";
import { SECTION_TITLES, itemFromEvent, sectionTypeForTags, type ResumeDocument, type ResumeItem, type SectionType } from "@/lib/resume";
import type { EventDTO } from "@/lib/profile";

export type PullResult = { item: ResumeItem; sectionType: SectionType }[];

/** "Pull from timeline": every log event not already on the resume, with the
 *  section it would land in. Picked events become items (and un-exclude). */
export function ResumePullDialog({ events, doc, onClose, onAdd }: { events: EventDTO[]; doc: ResumeDocument; onClose: () => void; onAdd: (picked: PullResult) => void }) {
  const onResume = useMemo(() => new Set(doc.sections.flatMap((s) => s.items.map((i) => i.eventId)).filter(Boolean)), [doc]);
  const candidates = useMemo(() => events.filter((e) => !onResume.has(e.id)), [events, onResume]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const shown = candidates.filter((e) => !q.trim() || `${e.title} ${e.body} ${e.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  function toggle(id: string) {
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function add() {
    onAdd(candidates.filter((e) => picked.has(e.id)).map((e) => ({ item: itemFromEvent(e), sectionType: sectionTypeForTags(e.tags) })));
    onClose();
  }

  return (
    <Dialog onClose={onClose} variant="wide" label="pull events from your timeline">
      <div className="emodal__head">
        <div>
          <h2 className="modal__title">pull from timeline<span className="colon">.</span></h2>
          <p className="emodal__sub">events not on the resume yet — pick the ones to add. each lands in the section its tags suggest.</p>
        </div>
        <button type="button" className="emodal__close" onClick={onClose} aria-label="close">×</button>
      </div>

      <div className="rsb-dialog">
        {candidates.length > 6 && (
          <div className="field" style={{ marginBottom: 0 }}>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter events…" aria-label="filter events" />
          </div>
        )}
        <div className="rsb-dialog__list" role="listbox" aria-multiselectable="true">
          {shown.length === 0 && <p className="rsb-dialog__empty">{candidates.length === 0 ? "every event is already on the resume." : "nothing matches."}</p>}
          {shown.map((e) => (
            <button key={e.id} type="button" role="option" aria-selected={picked.has(e.id)} className="rsb-pick" onClick={() => toggle(e.id)}>
              <span className="rsb-pick__box" aria-hidden="true">
                {picked.has(e.id) && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </span>
              <span className="rsb-pick__thumb">
                {isImageIcon(e.icon) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.icon} alt="" />
                ) : (e.icon || e.title.charAt(0).toLowerCase())}
              </span>
              <span className="rsb-pick__copy">
                <span className="rsb-pick__title">{e.title}</span>
                <span className="rsb-pick__meta">
                  {e.date} · {e.tags.map((t) => TAG_META[t]?.label ?? t).join(", ") || "untagged"} → {SECTION_TITLES[sectionTypeForTags(e.tags)].toLowerCase()}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="emodal__foot">
        <span className="emodal__esc">esc to close</span>
        <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
        <button type="button" className="btn btn--primary" onClick={add} disabled={picked.size === 0}>
          add {picked.size || ""} {picked.size === 1 ? "event" : "events"} →
        </button>
      </div>
    </Dialog>
  );
}
