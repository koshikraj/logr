"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import {
  saveEventAction,
  deleteEventAction,
  reorderEventsAction,
  unfurlLinkAction,
  type EventInput,
} from "@/lib/actions";
import { TAG_META } from "@/lib/theme";
import { isImageIcon } from "@/lib/icon";
import { uploadImage } from "@/lib/upload";
import { parseVideoUrl, parseTweetUrl } from "@/lib/video";
import { DatePicker } from "./DatePicker";
import { NarrateDialog } from "./NarrateDialog";
import { ImportDialog } from "./ImportDialog";
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

const TAG_OPTIONS = ["work", "milestone", "talk", "side_quest", "writing"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const todayISO = () => new Date().toISOString().slice(0, 10);
/** preview the timeline display from an ISO date (year is derived server-side) */
function fmtISO(iso: string, full: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  const mon = MONTHS[(m || 1) - 1];
  return full ? `${mon} ${d}, ${y}` : `${mon} ${y}`;
}

function emptyDraft(position: number): EventInput {
  return { dateOn: todayISO(), fullDate: false, title: "", tags: ["work"], featured: true, body: "", icon: null, linkLabel: null, linkHref: null, position, media: [] };
}
function toDraft(e: EditableEvent): EventInput {
  return { id: e.id, dateOn: e.dateOn, fullDate: e.fullDate, title: e.title, tags: e.tags, featured: e.featured, body: e.body, icon: e.icon, linkLabel: e.linkLabel, linkHref: e.linkHref, position: e.position, media: e.media };
}
function letter(s: string) { return (s.trim()[0] || "·").toLowerCase(); }

// ---------- EDIT / ADD MODAL ----------
type DetailKey = "body" | "icon" | "link" | "media";

/** Expandable optional-detail row: status dot + label + one-line summary + caret. */
function DetailRow({
  label, filled, open, summary, onToggle, children,
}: {
  label: string; filled: boolean; open: boolean; summary: string; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="emodal__row">
      <button type="button" className="emodal__row-head" onClick={onToggle} aria-expanded={open}>
        <span className="emodal__row-dot" data-filled={filled || undefined} aria-hidden="true" />
        <span className="emodal__row-label">{label}</span>
        <span className="emodal__row-summary">{summary}</span>
        <span className="emodal__row-caret" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="emodal__row-body">{children}</div>}
    </div>
  );
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function EventModal({ initial, username, onClose, onSaved }: { initial: EventInput; username: string; onClose: () => void; onSaved: (isNew: boolean) => void }) {
  const [draft, setDraft] = useState<EventInput>(initial);
  const [open, setOpen] = useState<Record<DetailKey, boolean>>({ body: false, icon: false, link: false, media: false });
  const [tagQuery, setTagQuery] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const toast = useToast();
  const iconFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function set<K extends keyof EventInput>(k: K, v: EventInput[K]) { setDraft((d) => ({ ...d, [k]: v })); }
  function toggleTag(t: string) {
    set("tags", draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t]);
  }
  const toggleRow = (k: DetailKey) => () => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // tag search: dims non-matching chips, ↵ toggles the first match
  const q = tagQuery.trim().toLowerCase();
  const tagMatches = q ? TAG_OPTIONS.filter((t) => (TAG_META[t]?.label ?? t).toLowerCase().includes(q)) : [];
  function onTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); if (tagMatches[0]) { toggleTag(tagMatches[0]); setTagQuery(""); } }
    if (e.key === "Escape") { e.stopPropagation(); setTagQuery(""); }
  }

  const tagLabels = draft.tags.map((t) => TAG_META[t]?.label ?? t).join(", ");
  const iconIsImage = isImageIcon(draft.icon);
  const summaries: Record<DetailKey, string> = {
    body: draft.body.trim() ? trunc(draft.body.trim(), 52) : "add a sentence or two",
    icon: iconIsImage ? "logo image" : draft.icon ? draft.icon : `auto — “${letter(draft.title)}” from the title`,
    link: draft.linkLabel?.trim() ? `${draft.linkLabel} → ${draft.linkHref ?? ""}` : "add a link",
    media: draft.media.length
      ? `${draft.media.length} item${draft.media.length > 1 ? "s" : ""} · ${draft.media.map((m) => m.provider ?? m.kind).join(", ")}`
      : "photos, videos, links",
  };
  const filled: Record<DetailKey, boolean> = {
    body: !!draft.body.trim(),
    icon: !!draft.icon,
    link: !!draft.linkLabel?.trim(),
    media: draft.media.length > 0,
  };

  async function uploadIcon(file?: File) {
    if (!file) return;
    setBusy(true);
    try { set("icon", await uploadImage(file)); } catch (e) { toast(e instanceof Error ? e.message : "Upload failed", "error"); } finally { setBusy(false); }
  }
  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = 8 - draft.media.length;
      const urls = await Promise.all(Array.from(files).slice(0, room).map(uploadImage));
      set("media", [...draft.media, ...urls.map((url) => ({ kind: "image" as const, url, poster: null, provider: null, title: null }))]);
    } catch (e) { toast(e instanceof Error ? e.message : "Upload failed", "error"); } finally { setBusy(false); }
  }
  // paste a URL: video links become embeds, anything else becomes a link card
  async function addUrl() {
    const url = videoUrl.trim();
    if (!url) return;
    if (draft.media.length >= 8) { toast("Up to 8 media items", "error"); return; }
    if (parseTweetUrl(url)) {
      set("media", [...draft.media, { kind: "tweet", url, poster: null, provider: "x", title: null }]);
      setVideoUrl("");
      return;
    }
    const v = parseVideoUrl(url);
    if (v) {
      set("media", [...draft.media, { kind: "video", url: v.embedUrl, poster: v.poster, provider: v.provider, title: null }]);
      setVideoUrl("");
      return;
    }
    setBusy(true);
    try {
      const link = await unfurlLinkAction(url);
      set("media", [...draft.media, link]);
      setVideoUrl("");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't add link", "error"); } finally { setBusy(false); }
  }
  function submit() {
    start(async () => { await saveEventAction(draft); onSaved(!initial.id); });
  }

  const featuredCheck = (
    <label className="check emodal__featured">
      <input type="checkbox" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} />
      <span className="check__box" />
      <span>include in highlights<br /><span className="emodal__featured-hint">shown by default on your page</span></span>
    </label>
  );

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__overlay" onClick={onClose} />
      <div className="emodal">
        <div className="emodal__head">
          <div>
            <h2 className="modal__title">{initial.id ? "edit event" : "new event"}<span className="colon">.</span></h2>
            <p className="emodal__sub">title, date, and a tag is all it takes — add detail only if the moment needs it.</p>
          </div>
          <button type="button" className="emodal__close" onClick={onClose} aria-label="close">×</button>
        </div>

        <div className="emodal__body">
          {/* form */}
          <div className="emodal__form">
            <div className="field">
              <label className="field__label">title</label>
              <input className="emodal__title-input" type="text" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="built something good." autoFocus />
            </div>

            <div className="emodal__date-row">
              <div className="field">
                <label className="field__label">date</label>
                <DatePicker
                  value={draft.dateOn || null}
                  onChange={(iso) => setDraft((d) => ({ ...d, dateOn: iso ?? "" }))}
                />
              </div>
              <label className="check emodal__day-check">
                <input type="checkbox" checked={draft.fullDate} onChange={(e) => set("fullDate", e.target.checked)} />
                <span className="check__box" />
                <span>show the day</span>
              </label>
            </div>

            <div className="field">
              <span className="field__label">tags</span>
              <div className="tag-pick">
                {TAG_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="tag-pick__chip"
                    aria-pressed={draft.tags.includes(t)}
                    data-dim={(q && !tagMatches.includes(t)) || undefined}
                    onClick={() => toggleTag(t)}
                  >
                    {TAG_META[t]?.label ?? t}
                  </button>
                ))}
                <input
                  className="emodal__tag-search"
                  type="text"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  onKeyDown={onTagKey}
                  placeholder="+ search…"
                />
              </div>
              {!!q && (
                <span className="emodal__tag-hint">
                  {tagMatches[0] ? <>↵ toggles “{TAG_META[tagMatches[0]]?.label ?? tagMatches[0]}”</> : "no matching tag"}
                </span>
              )}
            </div>

            <div className="emodal__details-cap">
              <span>details — optional</span>
              <span className="emodal__details-rule" aria-hidden="true" />
            </div>

            <DetailRow label="body" filled={filled.body} open={open.body} summary={summaries.body} onToggle={toggleRow("body")}>
              <textarea rows={3} value={draft.body} onChange={(e) => set("body", e.target.value)} placeholder="a sentence or two about this moment" />
            </DetailRow>

            <DetailRow label="icon" filled={filled.icon} open={open.icon} summary={summaries.icon} onToggle={toggleRow("icon")}>
              <div className="field-icon">
                <span className="field-icon__preview">
                  {iconIsImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.icon ?? ""} alt="" />
                  ) : (draft.icon || letter(draft.title))}
                </span>
                <input type="text" value={iconIsImage ? "" : draft.icon ?? ""} onChange={(e) => set("icon", e.target.value || null)} placeholder="🏆" maxLength={4} />
                <span className="field-icon__or" onClick={() => iconFileRef.current?.click()} style={{ cursor: "pointer" }}>
                  or <span style={{ color: "var(--user-accent)" }}>upload a logo</span>
                </span>
                <input ref={iconFileRef} type="file" accept="image/*" hidden onChange={(e) => uploadIcon(e.target.files?.[0])} />
              </div>
            </DetailRow>

            <DetailRow label="link" filled={filled.link} open={open.link} summary={summaries.link} onToggle={toggleRow("link")}>
              <div className="emodal__link-grid">
                <input type="text" value={draft.linkLabel ?? ""} onChange={(e) => set("linkLabel", e.target.value || null)} placeholder="label — heysage.me" />
                <input type="url" value={draft.linkHref ?? ""} onChange={(e) => set("linkHref", e.target.value || null)} placeholder="https://…" />
              </div>
            </DetailRow>

            <DetailRow label="media" filled={filled.media} open={open.media} summary={summaries.media} onToggle={toggleRow("media")}>
              <div className="field-photos">
                {draft.media.map((m, i) => (
                  <div key={i} className={`field-photos__cell${m.kind !== "image" ? " field-photos__cell--video" : ""}`} title={m.title ?? undefined}>
                    {m.kind === "image" || m.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.kind === "image" ? m.url : (m.poster as string)} alt="" />
                    ) : (
                      <span className="field-photos__vbg">{m.provider ?? m.kind}</span>
                    )}
                    {m.kind === "video" && <span className="field-photos__play" aria-hidden="true">▶</span>}
                    {m.kind === "link" && <span className="field-photos__play" aria-hidden="true">↗</span>}
                    {m.kind === "tweet" && <span className="field-photos__play" aria-hidden="true">𝕏</span>}
                    <button type="button" onClick={() => set("media", draft.media.filter((_, j) => j !== i))} aria-label="remove">×</button>
                  </div>
                ))}
                {draft.media.length < 8 && (
                  <button type="button" className="field-photos__add" onClick={() => photoFileRef.current?.click()} disabled={busy}>
                    {busy ? "…" : "+ photo"}
                  </button>
                )}
                <input ref={photoFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
              </div>
              <div className="field-video">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
                  placeholder="paste a video, article, or post link"
                />
                <button type="button" className="btn btn--small" onClick={addUrl} disabled={busy || !videoUrl.trim() || draft.media.length >= 8}>{busy ? "…" : "+ add"}</button>
              </div>
              <span className="field__hint">up to 8 — photos, videos (YouTube/Vimeo/Loom), and article/post links</span>
            </DetailRow>

            <div className="emodal__featured-mobile">{featuredCheck}</div>
          </div>

          <div className="emodal__divider" aria-hidden="true" />

          {/* live preview (desktop) */}
          <aside className="emodal__preview">
            <div className="emodal__preview-head">
              <span className="emodal__preview-cap"><span aria-hidden="true" />live preview</span>
              <span className="emodal__preview-domain">logr.life/{username}</span>
            </div>

            <div className="pv-entry-wrap">
              <article className="pv-entry">
                <span className="pv-entry__rail" aria-hidden="true" />
                <span className="pv-entry__dot" aria-hidden="true" />
                <div className="pv-entry__meta">
                  {draft.dateOn ? fmtISO(draft.dateOn, draft.fullDate) : "pick a date"} <span className="accent">· {tagLabels || "untagged"}</span>
                </div>
                <h3 className="pv-entry__title">
                  <span className="pv-entry__icon" aria-hidden="true">
                    {iconIsImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.icon ?? ""} alt="" />
                    ) : (draft.icon || letter(draft.title))}
                  </span>
                  <span>{draft.title.trim() || "built something good."}</span>
                </h3>
                {!!draft.body.trim() && <p className="pv-entry__body">{draft.body}</p>}
                {draft.media.length > 0 && (
                  <div className="pv-entry__media">
                    {draft.media.map((m, i) => (
                      <span key={i} className="pv-entry__thumb">
                        {m.kind === "image" || m.poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.kind === "image" ? m.url : (m.poster as string)} alt="" />
                        ) : (m.kind === "tweet" ? "𝕏" : m.kind === "video" ? "▶" : "↗")}
                      </span>
                    ))}
                  </div>
                )}
                {!!draft.linkLabel?.trim() && <span className="pv-entry__link">{draft.linkLabel} ↗</span>}
              </article>

              {/* faded next-entry skeleton for timeline context */}
              <div className="pv-ghost" aria-hidden="true">
                <span className="pv-ghost__dot" />
                <span className="pv-ghost__line" style={{ width: "38%" }} />
                <span className="pv-ghost__line pv-ghost__line--title" style={{ width: "64%" }} />
              </div>
            </div>

            <div className="emodal__preview-foot">{featuredCheck}</div>
          </aside>
        </div>

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
  const [dialog, setDialog] = useState<EventInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EditableEvent | null>(null);
  const [narrate, setNarrate] = useState(false);
  const [importing, setImporting] = useState(false);
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
              <span className="hl-head__guide">add a moment manually, import a resume, or narrate your story in prose.</span>
              <span className="hl-head__hint">drag rows to reorder</span>
            </div>
          </div>
          <div className="hl-head__actions">
            <button type="button" className="btn btn--small" onClick={() => setImporting(true)}>
              <svg className="btn__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M8 11V3M8 3L5.5 5.5M8 3l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 13h10" strokeLinecap="round" />
              </svg>
              import
            </button>
            <button type="button" className="btn btn--small" onClick={() => setNarrate(true)}>
              <svg className="btn__ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              narrate
            </button>
            <span className="hl-head__actions-sep" aria-hidden="true" />
            <button type="button" className="btn btn--small btn--primary" onClick={() => setDialog(emptyDraft(nextPosition))}>
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
              onEdit={() => setDialog(toDraft(e))}
              onDelete={() => setConfirmDelete(e)}
              onCommit={commitOrder}
            />
          ))}
        </Reorder.Group>
      </div>

      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {narrate && <NarrateDialog onClose={() => setNarrate(false)} />}

      {dialog && (
        <EventModal
          initial={dialog}
          username={username}
          onClose={() => setDialog(null)}
          onSaved={(isNew) => { setDialog(null); toast(isNew ? "Event added" : "Event updated"); router.refresh(); }}
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
