"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import {
  saveEventAction,
  deleteEventAction,
  reorderEventsAction,
  type EventInput,
} from "@/lib/actions";
import { TAG_META } from "@/lib/theme";
import { isImageIcon } from "@/lib/icon";
import { EventEditor, letter } from "./EventEditor";
import { AddEventsDialog, type AddMode } from "./AddEventsDialog";
import type { MediaItem } from "@/lib/profile";

export type EditableEvent = {
  id: string;
  dateOn: string;
  date: string; // derived display, for the row
  fullDate: boolean;
  title: string;
  tags: string[];
  featured: boolean;
  body: string;
  icon: string | null;
  linkLabel: string | null;
  linkHref: string | null;
  position: number;
  media: MediaItem[];
};

function toDraft(e: EditableEvent): EventInput {
  return { id: e.id, dateOn: e.dateOn, fullDate: e.fullDate, title: e.title, tags: e.tags, featured: e.featured, body: e.body, icon: e.icon, linkLabel: e.linkLabel, linkHref: e.linkHref, position: e.position, media: e.media };
}

// ---------- EDIT MODAL (existing events; adding goes through AddEventsDialog) ----------
function EventModal({ initial, username, onClose, onSaved }: { initial: EventInput; username: string; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<EventInput>(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function submit() {
    start(async () => { await saveEventAction(draft); onSaved(); });
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__overlay" onClick={onClose} />
      <div className="emodal">
        <div className="emodal__head">
          <div>
            <h2 className="modal__title">edit event<span className="colon">.</span></h2>
            <p className="emodal__sub">title, date, and a tag is all it takes — add detail only if the moment needs it.</p>
          </div>
          <button type="button" className="emodal__close" onClick={onClose} aria-label="close">×</button>
        </div>

        <EventEditor draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} username={username} />

        <div className="emodal__foot">
          <span className="emodal__esc">esc to close</span>
          <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={pending || !draft.title.trim() || !draft.dateOn}>
            {pending ? "saving…" : "save event →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- DRAGGABLE ROW ----------
function EventRow({
  e,
  onEdit,
  onDelete,
  onCommit,
}: {
  e: EditableEvent;
  onEdit: () => void;
  onDelete: () => void;
  onCommit: () => void;
}) {
  const controls = useDragControls();
  const accent = e.tags.includes("milestone");
  const tagLabels = e.tags.map((t) => TAG_META[t]?.label ?? t).join(", ");
  const photos = e.media.filter((m) => m.kind === "image");
  const videos = e.media.filter((m) => m.kind === "video");
  const linksN = e.media.filter((m) => m.kind === "link").length;
  const tweetsN = e.media.filter((m) => m.kind === "tweet").length;
  const thumb = photos[0]?.url ?? videos[0]?.poster ?? e.media.find((m) => m.poster)?.poster ?? null;
  const counts = [
    photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "",
    videos.length ? `${videos.length} video${videos.length > 1 ? "s" : ""}` : "",
    linksN ? `${linksN} link${linksN > 1 ? "s" : ""}` : "",
    tweetsN ? `${tweetsN} tweet${tweetsN > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(" · ");
  return (
    <Reorder.Item
      value={e}
      as="div"
      className="hl-row"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      whileDrag={{ scale: 1.01, backgroundColor: "var(--paper)", borderRadius: 10, boxShadow: "0 16px 40px -14px rgba(0,0,0,0.4)", zIndex: 5 }}
    >
      <button
        type="button"
        className="hl-row__handle"
        aria-label="drag to reorder"
        onPointerDown={(ev) => controls.start(ev)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="6" cy="3" r="1.3" /><circle cx="10" cy="3" r="1.3" /><circle cx="6" cy="8" r="1.3" /><circle cx="10" cy="8" r="1.3" /><circle cx="6" cy="13" r="1.3" /><circle cx="10" cy="13" r="1.3" />
        </svg>
      </button>
      <div className={`hl-row__thumb ${accent ? "hl-row__thumb--accent" : ""}`}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" />
        ) : isImageIcon(e.icon) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.icon} alt="" />
        ) : (e.icon || letter(e.title))}
      </div>
      <div className="hl-row__copy">
        <span className="hl-row__title">{e.title}{e.featured && <span className="hl-row__star" title="in highlights"> ★</span>}</span>
        <span className="hl-row__meta">
          {e.date} · <span className={accent ? "accent" : undefined}>{tagLabels}</span>
          {counts && ` · ${counts}`}
          {e.linkLabel && ` · ${e.linkLabel}`}
        </span>
      </div>
      <div className="hl-row__actions">
        <button onClick={onEdit}>edit</button>
        <button className="danger" onClick={onDelete}>delete</button>
      </div>
    </Reorder.Item>
  );
}

export function EventsManager({ events, username, onItemsChange }: { events: EditableEvent[]; username: string; onItemsChange?: (items: EditableEvent[]) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<EventInput | null>(null);
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EditableEvent | null>(null);
  const [pending, start] = useTransition();

  // Local order for drag-and-drop; resynced from props when the set/order changes.
  const [items, setItems] = useState(events);
  const sig = events.map((e) => e.id).join(",");
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setItems(events);
  }
  // keep the live preview in sync with the current (drag/CRUD) order + content
  useEffect(() => { onItemsChange?.(items); }, [items, onItemsChange]);

  const nextPosition = items.length ? Math.min(...items.map((e) => e.position)) - 1 : 0;
  const featuredCount = items.filter((e) => e.featured).length;

  function commitOrder() {
    const order = items.map((i) => i.id);
    start(async () => {
      await reorderEventsAction(order);
      toast("Order saved");
    });
  }
  function doDelete(e: EditableEvent) {
    start(async () => { await deleteEventAction(e.id); setConfirmDelete(null); toast("Event deleted"); router.refresh(); });
  }

  return (
    <section role="tabpanel">
      <div className="card">
        <div className="hl-head">
          <div className="hl-head__meta">
            <div className="hl-stats">
              <span className="hl-stat"><span className="accent">{items.length}</span> events</span>
              <span className="hl-stat-sep" aria-hidden="true" />
              <span className="hl-stat"><span className="accent">{featuredCount}</span> in highlights</span>
            </div>
            <div className="hl-head__hints">
              <span className="hl-head__guide">add a moment manually, or let ai draft events from your story, resume, or a link.</span>
              <span className="hl-head__hint">drag rows to reorder</span>
            </div>
          </div>
          <div className="hl-head__actions">
            <button type="button" className="btn btn--small" onClick={() => setAdding("narrate")}>
              <svg className="btn__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              import · ai
            </button>
            <span className="hl-head__actions-sep" aria-hidden="true" />
            <button type="button" className="btn btn--small btn--primary" onClick={() => setAdding("write")}>
              <svg className="btn__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
              </svg>
              add event
            </button>
          </div>
        </div>

        <Reorder.Group as="div" axis="y" values={items} onReorder={setItems} className="hl-list">
          {items.map((e) => (
            <EventRow
              key={e.id}
              e={e}
              onEdit={() => setEditing(toDraft(e))}
              onDelete={() => setConfirmDelete(e)}
              onCommit={commitOrder}
            />
          ))}
        </Reorder.Group>
      </div>

      {adding && (
        <AddEventsDialog
          initialMode={adding}
          nextPosition={nextPosition}
          username={username}
          onClose={() => setAdding(null)}
        />
      )}

      {editing && (
        <EventModal
          initial={editing}
          username={username}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast("Event updated"); router.refresh(); }}
        />
      )}

      {confirmDelete && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__overlay" onClick={() => setConfirmDelete(null)} />
          <div className="modal__card" style={{ maxWidth: 420 }}>
            <h2 className="modal__title">delete event<span className="colon">?</span></h2>
            <p className="modal__sub">“{confirmDelete.title}” will be permanently removed. this can&apos;t be undone.</p>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>cancel</button>
              <button type="button" className="btn btn--primary" disabled={pending} onClick={() => doDelete(confirmDelete)}>
                {pending ? "deleting…" : "delete →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
