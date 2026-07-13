"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import {
  saveEventAction,
  insertEventsAction,
  narrateEventsAction,
  importFileAction,
  importUrlAction,
  type EventInput,
  type ReviewEvent,
} from "@/lib/actions";
import { TAG_META } from "@/lib/theme";
import { EventEditor, PvEntry, fmtISO, todayISO } from "./EventEditor";

export type AddMode = "write" | "narrate" | "file" | "url";

const MODES: { value: AddMode; glyph: string; label: string }[] = [
  { value: "write", glyph: "✍", label: "write" },
  { value: "narrate", glyph: "¶", label: "narrate" },
  { value: "file", glyph: "↑", label: "file" },
  { value: "url", glyph: "⊕", label: "url" },
];

const SUBS: Record<AddMode, string> = {
  write: "title, date, and a tag is all it takes — add detail only if the moment needs it.",
  narrate: "tell your story in plain words — logr drafts the events for review.",
  file: "upload your resume or CV — logr extracts your timeline for review.",
  url: "link a portfolio or LinkedIn page — logr extracts your timeline for review.",
};

type Item = EventInput & { include: boolean };

function toItem(e: ReviewEvent): Item {
  return {
    dateOn: e.dateOn, fullDate: e.fullDate, title: e.title, tags: e.tags, featured: e.featured,
    body: e.body, icon: e.icon ?? null, linkLabel: e.linkLabel ?? null, linkHref: e.linkHref ?? null,
    position: 0, media: e.media, include: true,
  };
}
function toReview(it: Item): ReviewEvent {
  return {
    dateOn: it.dateOn, fullDate: it.fullDate, title: it.title, tags: it.tags, featured: it.featured,
    body: it.body, icon: it.icon, linkLabel: it.linkLabel, linkHref: it.linkHref, media: it.media,
  };
}
function emptyDraft(position: number): EventInput {
  return { dateOn: todayISO(), fullDate: false, title: "", tags: ["work"], featured: true, body: "", icon: null, linkLabel: null, linkHref: null, position, media: [] };
}

/** Unified add-events dialog: write manually, or narrate / file / url → AI
 *  extraction → review checklist. Editing a reviewed row opens the same full
 *  EventEditor the manual path uses. */
export function AddEventsDialog({
  initialMode,
  nextPosition,
  username,
  tagOptions,
  onClose,
}: {
  initialMode: AddMode;
  nextPosition: number;
  username: string;
  tagOptions: string[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [draft, setDraft] = useState<EventInput>(() => emptyDraft(nextPosition));
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const patchItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => (arr ? arr.map((it, j) => (j === i ? { ...it, ...patch } : it)) : arr));

  async function extract() {
    setLoading(true);
    setError(null);
    try {
      let events: ReviewEvent[];
      if (mode === "narrate") {
        events = await narrateEventsAction(text);
      } else if (mode === "file") {
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        events = await importFileAction(fd);
      } else {
        events = await importUrlAction(url.trim());
      }
      if (!events.length) {
        setError(mode === "narrate" ? "No events found — try adding more detail or dates." : "No events found — try a different file or URL.");
      } else {
        setItems(events.map(toItem));
        setEditing(events.length === 1 ? 0 : null); // one event → straight into the editor
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function saveManual() {
    start(async () => {
      await saveEventAction(draft);
      toast("Event added");
      router.refresh();
      onClose();
    });
  }

  function insertReviewed() {
    const chosen = (items ?? []).filter((it) => it.include && it.title.trim()).map(toReview);
    if (!chosen.length) { toast("Select at least one event", "error"); return; }
    start(async () => {
      await insertEventsAction(chosen);
      toast(`Added ${chosen.length} event${chosen.length > 1 ? "s" : ""}`);
      router.refresh();
      onClose();
    });
  }

  const canExtract = mode === "narrate" ? !!text.trim() : mode === "file" ? !!file : !!url.trim();
  const includedCount = (items ?? []).filter((it) => it.include).length;
  const reviewing = items !== null;
  const editingItem = reviewing && editing !== null ? items[editing] : null;

  return (
    <Dialog onClose={onClose} variant="wide" label={reviewing ? "review events" : "add events"}>
        <div className="emodal__head">
          <div>
            <h2 className="modal__title">
              {reviewing ? "review events" : "add events"}<span className="colon">.</span>
            </h2>
            <p className="emodal__sub">
              {reviewing
                ? editingItem
                  ? "tweak this event — everything the manual editor has."
                  : "uncheck what doesn't belong, edit anything worth polishing."
                : SUBS[mode]}
            </p>
          </div>
          <button type="button" className="emodal__close" onClick={onClose} aria-label="close">×</button>
        </div>

        {!reviewing && (
          <div className="emodal__modes" role="tablist" aria-label="how to add events">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="tab"
                className={`import-tab${mode === m.value ? " is-active" : ""}`}
                aria-selected={mode === m.value}
                onClick={() => { setMode(m.value); setError(null); }}
              >
                <span className="import-tab__glyph">{m.glyph}</span> {m.label}
              </button>
            ))}
          </div>
        )}

        {/* ---------- stage 1: write manually ---------- */}
        {!reviewing && mode === "write" && (
          <>
            <EventEditor draft={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} username={username} tagOptions={tagOptions} />
            <div className="emodal__foot">
              <span className="emodal__esc">esc to close</span>
              <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
              <button type="button" className="btn btn--primary" onClick={saveManual} disabled={pending || !draft.title.trim() || !draft.dateOn}>
                {pending ? "saving…" : "save event →"}
              </button>
            </div>
          </>
        )}

        {/* ---------- stage 1: collect narrate / file / url input ---------- */}
        {!reviewing && mode !== "write" && (
          <>
            <div className="emodal__single">
              {mode === "narrate" && (
                <div className="field">
                  <textarea
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. I authored a blockchain book in 2018, moved to Bangalore in 2019 and founded Consenso Labs. Won the AA hackathon in April 2023 with ZenGuard…"
                    autoFocus
                  />
                </div>
              )}
              {mode === "file" && (
                <div className="field">
                  <div
                    className={`import-drop${file ? " has-file" : ""}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) setFile(f);
                    }}
                  >
                    {file ? (
                      <>
                        <span className="import-drop__icon">✓</span>
                        <span className="import-drop__name">{file.name}</span>
                        <span className="import-drop__types">click to change</span>
                      </>
                    ) : (
                      <>
                        <span className="import-drop__icon">↑</span>
                        <span className="import-drop__hint">drag &amp; drop or click to upload</span>
                        <span className="import-drop__types">PDF · DOCX · TXT</span>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              )}
              {mode === "url" && (
                <div className="field">
                  <label className="field__label">portfolio or LinkedIn URL</label>
                  <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourname.com" autoFocus />
                  <span className="field__hint">any public portfolio, personal site, or LinkedIn profile</span>
                </div>
              )}
              {error && <p className="field__hint" style={{ color: "var(--user-accent)" }}>{error}</p>}
            </div>
            <div className="emodal__foot">
              <span className="emodal__esc">esc to close</span>
              <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
              <button type="button" className="btn btn--primary" onClick={extract} disabled={loading || !canExtract}>
                {loading ? "reading…" : "extract events →"}
              </button>
            </div>
          </>
        )}

        {/* ---------- stage 2: edit one reviewed event (full editor) ---------- */}
        {reviewing && editingItem && (
          <>
            <EventEditor
              key={editing}
              draft={editingItem}
              onChange={(p) => patchItem(editing as number, p)}
              username={username}
              tagOptions={tagOptions}
            />
            <div className="emodal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>← back to list</button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={items && items.length === 1 ? insertReviewed : () => setEditing(null)}
                disabled={pending}
              >
                {items && items.length === 1 ? (pending ? "adding…" : "add event →") : "done →"}
              </button>
            </div>
          </>
        )}

        {/* ---------- stage 2: review checklist · stacked timeline preview ---------- */}
        {reviewing && !editingItem && (
          <>
            <div className="emodal__body">
              <div className="emodal__form">
                <div className="rev">
                  {items.map((it, i) => (
                    <div key={i} className={`rev__row${it.include ? "" : " is-off"}`}>
                      <label className="check rev__check">
                        <input type="checkbox" checked={it.include} onChange={(e) => patchItem(i, { include: e.target.checked })} />
                        <span className="check__box" />
                      </label>
                      <span className="rev__date">{it.dateOn ? fmtISO(it.dateOn, it.fullDate) : "no date"}</span>
                      <span className="rev__title">{it.title || "untitled"}</span>
                      <span className="rev__tags">{it.tags.map((t) => TAG_META[t]?.label ?? t).join(", ")}</span>
                      <button type="button" className="rev__edit" onClick={() => setEditing(i)}>edit</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="emodal__divider" aria-hidden="true" />

              <aside className="emodal__preview">
                <div className="emodal__preview-head">
                  <span className="emodal__preview-cap"><span aria-hidden="true" />live preview</span>
                  <span className="emodal__preview-domain">logr.it/{username}</span>
                </div>
                <div className="pv-entry-wrap pv-entry-wrap--stack">
                  {items.filter((it) => it.include).map((it, i) => <PvEntry key={i} e={it} />)}
                  {includedCount === 0 && <p className="pv-empty">nothing selected — check an event to preview it.</p>}
                </div>
              </aside>
            </div>
            <div className="emodal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => { setItems(null); setEditing(null); }}>← back</button>
              <button type="button" className="btn btn--primary" onClick={insertReviewed} disabled={pending || includedCount === 0}>
                {pending ? "adding…" : `add ${includedCount} event${includedCount === 1 ? "" : "s"} →`}
              </button>
            </div>
          </>
        )}
    </Dialog>
  );
}
