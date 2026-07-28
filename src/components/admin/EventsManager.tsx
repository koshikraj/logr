"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { AgentAvatar } from "@/components/AgentAvatar";
import {
  saveEventAction,
  deleteEventAction,
  reorderEventsAction,
  updatePinnedAction,
  type EventInput,
} from "@/lib/actions";
import { TAG_META } from "@/lib/theme";
import { isImageIcon } from "@/lib/icon";
import { EventEditor, letter, TAG_OPTIONS } from "./EventEditor";
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
function EventModal({ initial, username, tagOptions, onClose, onSaved }: { initial: EventInput; username: string; tagOptions: string[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<EventInput>(initial);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => { await saveEventAction(draft); onSaved(); });
  }

  return (
    <Dialog onClose={onClose} variant="wide" label="edit event">
      <div className="emodal__head">
        <div>
          <h2 className="modal__title">edit event<span className="colon">.</span></h2>
          <p className="emodal__sub">title, date, and a tag is all it takes — add detail only if the moment needs it.</p>
        </div>
        <button type="button" className="emodal__close" onClick={onClose} aria-label="close">×</button>
      </div>

      <EventEditor draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} username={username} tagOptions={tagOptions} />

      <div className="emodal__foot">
        <span className="emodal__esc">esc to close</span>
        <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
        <button type="button" className="btn btn--primary" onClick={submit} disabled={pending || !draft.title.trim() || !draft.dateOn}>
          {pending ? "saving…" : "save event →"}
        </button>
      </div>
    </Dialog>
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
  const instasN = e.media.filter((m) => m.kind === "instagram").length;
  const thumb = photos[0]?.url ?? videos[0]?.poster ?? e.media.find((m) => m.poster)?.poster ?? null;
  const counts = [
    photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "",
    videos.length ? `${videos.length} video${videos.length > 1 ? "s" : ""}` : "",
    linksN ? `${linksN} link${linksN > 1 ? "s" : ""}` : "",
    tweetsN ? `${tweetsN} tweet${tweetsN > 1 ? "s" : ""}` : "",
    instasN ? `${instasN} insta post${instasN > 1 ? "s" : ""}` : "",
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

// ---------- PINS MODAL (choose up to 7 events for the public "pinned" rail) ----------
function PinsDialog({ items, initial, onClose, onSaved }: { items: EditableEvent[]; initial: string[]; onClose: () => void; onSaved: () => void }) {
  // seed only with pins whose event still exists (deleted-in-session events drop out)
  const [pinned, setPinned] = useState(() => initial.filter((id) => items.some((e) => e.id === id)));
  const [pending, start] = useTransition();

  // newest-first — mirrors the rail's derived display order
  const pinnable = [...items].sort((a, b) => (b.dateOn || "").localeCompare(a.dateOn || ""));
  const pinnedSet = new Set(pinned);

  function toggle(id: string, on: boolean) {
    setPinned(on ? [...pinned, id] : pinned.filter((p) => p !== id));
  }
  function save() {
    start(async () => { await updatePinnedAction(pinned); onSaved(); });
  }

  return (
    <Dialog onClose={onClose} label="pinned events" className="modal__card--pins">
      <h2 className="modal__title">pinned events<span className="colon">:</span></h2>
      <p className="modal__sub">pin up to 7 — they replace “recent” on your page’s side rail, newest first.</p>
      <div className="rev rev--pins">
        {pinnable.map((e) => {
          const checked = pinnedSet.has(e.id);
          const atCap = !checked && pinnedSet.size >= 7;
          return (
            <div key={e.id} className={`rev__row${atCap ? " is-off" : ""}`}>
              <label className="check rev__check">
                <input type="checkbox" checked={checked} disabled={atCap} onChange={(ev) => toggle(e.id, ev.target.checked)} />
                <span className="check__box" />
              </label>
              <span className="rev__date">{e.date}</span>
              <span className="rev__title">{e.title || "untitled"}</span>
              <span className="rev__tags">{e.tags.map((t) => TAG_META[t]?.label ?? t).join(", ")}</span>
            </div>
          );
        })}
      </div>
      <div className="modal__foot">
        <span className="hl-stat" style={{ marginRight: "auto" }}><span className="accent">{pinnedSet.size}</span> / 7 pinned</span>
        <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
        <button type="button" className="btn btn--primary" disabled={pending} onClick={save}>
          {pending ? "saving…" : "save pins →"}
        </button>
      </div>
    </Dialog>
  );
}

export function EventsManager({ events, username, pinnedIds = [], onItemsChange }: { events: EditableEvent[]; username: string; pinnedIds?: string[]; onItemsChange?: (items: EditableEvent[]) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<EventInput | null>(null);
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
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
  const pinnedCount = pinnedIds.filter((id) => items.some((e) => e.id === id)).length;
  // built-ins + customs found on this profile's events — a saved custom tag
  // becomes a searchable chip for every event after that
  const tagOptions = [...TAG_OPTIONS, ...Array.from(new Set(items.flatMap((e) => e.tags))).filter((t) => !TAG_OPTIONS.includes(t))];

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
              <span className="hl-stat-sep" aria-hidden="true" />
              <span className="hl-stat"><span className="accent">{pinnedCount}</span> pinned</span>
            </div>
            <div className="hl-head__hints">
              <span className="hl-head__guide">add a moment manually, or let ai draft events from your story, resume, or a link.</span>
              <span className="hl-head__hint">drag rows to reorder</span>
            </div>
          </div>
          <div className="hl-head__actions">
            {items.length > 0 && (
              <>
                <button type="button" className="btn btn--small" onClick={() => setPinsOpen(true)}>
                  <svg className="btn__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                    <path d="M6 2.5h4l-.6 3.2 2.6 2.3v.5H4v-.5l2.6-2.3L6 2.5zM8 8.5V13" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  pins
                </button>
                <span className="hl-head__actions-sep" aria-hidden="true" />
              </>
            )}
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

        {items.length === 0 && (
          <div className="agv-sleepy">
            <AgentAvatar state="sleeping" size={26} />
            <span>no events yet — loggy is napping. add a moment, or let it draft from your story or sources.</span>
          </div>
        )}
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

      {pinsOpen && (
        <PinsDialog
          items={items}
          initial={pinnedIds}
          onClose={() => setPinsOpen(false)}
          onSaved={() => { setPinsOpen(false); toast("Pins saved"); router.refresh(); }}
        />
      )}

      {adding && (
        <AddEventsDialog
          initialMode={adding}
          nextPosition={nextPosition}
          username={username}
          tagOptions={tagOptions}
          onClose={() => setAdding(null)}
        />
      )}

      {editing && (
        <EventModal
          initial={editing}
          username={username}
          tagOptions={tagOptions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast("Event updated"); router.refresh(); }}
        />
      )}

      {confirmDelete && (
        <Dialog onClose={() => setConfirmDelete(null)} label="delete event" className="modal__card--sm">
          <h2 className="modal__title">delete event<span className="colon">?</span></h2>
          <p className="modal__sub">“{confirmDelete.title}” will be permanently removed. this can&apos;t be undone.</p>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>cancel</button>
            <button type="button" className="btn btn--primary" disabled={pending} onClick={() => doDelete(confirmDelete)}>
              {pending ? "deleting…" : "delete →"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
