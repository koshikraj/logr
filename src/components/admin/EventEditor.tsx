"use client";

import { useState, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { unfurlLinkAction, type EventInput } from "@/lib/actions";
import { TAG_META } from "@/lib/theme";
import { isImageIcon } from "@/lib/icon";
import { uploadImage } from "@/lib/upload";
import { parseVideoUrl, parseTweetUrl } from "@/lib/video";
import { DatePicker } from "./DatePicker";

export const TAG_OPTIONS = ["work", "milestone", "talk", "side_quest", "writing"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const todayISO = () => new Date().toISOString().slice(0, 10);
/** preview the timeline display from an ISO date (year is derived server-side) */
export function fmtISO(iso: string, full: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  const mon = MONTHS[(m || 1) - 1];
  return full ? `${mon} ${d}, ${y}` : `${mon} ${y}`;
}
export function letter(s: string) { return (s.trim()[0] || "·").toLowerCase(); }
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

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

/** The v2 event editor: essentials + detail rows (left) · live timeline-entry
 *  preview (right, desktop). Controlled: renders `draft`, emits patches via
 *  `onChange`. Shared by the add-events dialog and the edit-event modal. */
export function EventEditor({
  draft,
  onChange,
  username,
}: {
  draft: EventInput;
  onChange: (patch: Partial<EventInput>) => void;
  username: string;
}) {
  const [open, setOpen] = useState<Record<DetailKey, boolean>>({ body: false, icon: false, link: false, media: false });
  const [tagQuery, setTagQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const toast = useToast();
  const iconFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof EventInput>(k: K, v: EventInput[K]) { onChange({ [k]: v }); }
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

  const featuredCheck = (
    <label className="check emodal__featured">
      <input type="checkbox" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} />
      <span className="check__box" />
      <span>include in highlights<br /><span className="emodal__featured-hint">shown by default on your page</span></span>
    </label>
  );

  return (
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
              onChange={(iso) => set("dateOn", iso ?? "")}
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
  );
}
