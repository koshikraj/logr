"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { ResumeIcon } from "@/components/resume/ResumeIcon";
import { TEMPLATE_META } from "@/components/resume/ResumeSheet";
import { SECTION_DEFAULT_ICON } from "@/components/resume/icons";
import {
  generateResumeAction,
  polishResumeAction,
  saveResumeAction,
  setResumePublishedAction,
} from "@/lib/actions";
import {
  sectionTypeForTags,
  applyPolish,
  RESUME_LIMITS,
  RESUME_PAGE_COUNTS,
  RESUME_PAGE_SIZES,
  RESUME_TEMPLATES,
  SECTION_TITLES,
  SECTION_TYPES,
  type ResumeDocument,
  type ResumeItem,
  type ResumePageCount,
  type ResumePageSize,
  type ResumePolish,
  type ResumeSection,
  type ResumeTemplate,
  type SectionType,
} from "@/lib/resume";
import type { ResumeView } from "@/lib/resume-data";
import { formatResumeRange, newResumeId } from "@/lib/resume-format";
import { ACCENT_SWATCHES } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import type { EventDTO } from "@/lib/profile";
import { ResumeIconPicker } from "./ResumeIconPicker";
import { ResumePullDialog, type PullResult } from "./ResumePullDialog";
import { ResumePolishDialog } from "./ResumePolishDialog";

export type ResumeEditorState = { doc: ResumeDocument; template: ResumeTemplate; pageSize: ResumePageSize; pages: ResumePageCount };

type SaveStatus = "saved" | "dirty" | "saving" | "error";

const sig = (s: ResumeEditorState) => JSON.stringify([s.doc, s.template, s.pageSize, s.pages]);

// same rule as the server: YYYY, YYYY-MM or YYYY-MM-DD with a real month/day
const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

function DragHandle({ onStart, className }: { onStart: (e: React.PointerEvent) => void; className: string }) {
  return (
    <button type="button" className={className} aria-label="drag to reorder" onPointerDown={onStart}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="3" r="1.3" /><circle cx="10" cy="3" r="1.3" /><circle cx="6" cy="8" r="1.3" /><circle cx="10" cy="8" r="1.3" /><circle cx="6" cy="13" r="1.3" /><circle cx="10" cy="13" r="1.3" />
      </svg>
    </button>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="rsb-switch-row">
      <button type="button" role="switch" aria-checked={on} className="rsb-switch" onClick={() => onChange(!on)} disabled={disabled} aria-label={label} />
      {label}
    </label>
  );
}

/** Text field that only commits valid resume dates ("2024", "2024-03", "2024-03-15"). */
function DateInput({ value, onChange, placeholder, allowPresent }: { value: string | null; onChange: (v: string | null) => void; placeholder: string; allowPresent?: boolean }) {
  const [raw, setRaw] = useState(value ?? "");
  const [bad, setBad] = useState(false);
  // reset the draft when the committed value changes from outside (state-from-props, no effect)
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setRaw(value ?? ""); setBad(false); }
  const present = value === "present";
  return (
    <div className="rsb-f">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          value={present ? "" : raw}
          disabled={present}
          placeholder={present ? "present" : placeholder}
          onChange={(e) => {
            const v = e.target.value.trim();
            setRaw(v);
            if (!v) { setBad(false); onChange(null); return; }
            if (DATE_RE.test(v)) { setBad(false); onChange(v); } else setBad(true);
          }}
          aria-invalid={bad}
        />
        {allowPresent && (
          <button type="button" className={`btn btn--small${present ? " btn--primary" : ""}`} onClick={() => onChange(present ? null : "present")} style={{ whiteSpace: "nowrap" }}>
            present
          </button>
        )}
      </div>
      {bad && <span className="rsb-f__hint" style={{ color: "#c2492e" }}>use YYYY, YYYY-MM or YYYY-MM-DD</span>}
    </div>
  );
}

// ---------- item ----------
function ItemCard({ item, onChange, onRemove, showImage }: { item: ResumeItem; onChange: (patch: Partial<ResumeItem>) => void; onRemove: () => void; showImage: boolean }) {
  const controls = useDragControls();
  const [open, setOpen] = useState(false);
  const range = formatResumeRange(item);
  return (
    <Reorder.Item
      value={item}
      as="div"
      className="rsb-item"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, boxShadow: "0 16px 40px -14px rgba(0,0,0,0.4)", zIndex: 5 }}
    >
      <div className="rsb-item__row">
        <DragHandle className="rsb-item__handle" onStart={(e) => controls.start(e)} />
        <ResumeIconPicker value={item.icon} onChange={(icon) => onChange({ icon })} size={26} title="item icon" />
        <div className="rsb-item__summary" onClick={() => setOpen((o) => !o)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }} aria-expanded={open}>
          <span className={`rsb-item__title${item.title ? "" : " rsb-item__title--empty"}`}>{item.title || "untitled"}</span>
          <span className="rsb-item__meta">
            {range && <span className="accent">{range}</span>}
            {range && (item.subtitle || item.bullets.length) ? " · " : ""}
            {item.subtitle}
            {item.subtitle && item.bullets.length ? " · " : ""}
            {item.bullets.length ? `${item.bullets.length} bullet${item.bullets.length > 1 ? "s" : ""}` : ""}
            {item.eventId ? "" : " · free-form"}
          </span>
        </div>
        <div className="rsb-item__actions">
          <button type="button" className="rsb-ibtn" onClick={() => setOpen((o) => !o)} aria-label={open ? "collapse" : "edit"} aria-pressed={open}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 160ms" }}><path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="rsb-ibtn rsb-ibtn--danger" onClick={onRemove} aria-label="remove item">×</button>
        </div>
      </div>
      {open && (
        <div className="rsb-item__edit">
          <div className="rsb-grid">
            <div className="rsb-f">
              <label>title</label>
              <input value={item.title} maxLength={200} onChange={(e) => onChange({ title: e.target.value })} />
            </div>
            <div className="rsb-f">
              <label>subtitle · company / venue / degree</label>
              <input value={item.subtitle ?? ""} maxLength={200} onChange={(e) => onChange({ subtitle: e.target.value || null })} />
            </div>
          </div>
          <div className="rsb-grid rsb-grid--3">
            <div className="rsb-f">
              <label>from</label>
              <DateInput value={item.dateFrom} onChange={(dateFrom) => onChange({ dateFrom })} placeholder="2024-03" />
            </div>
            <div className="rsb-f">
              <label>to</label>
              <DateInput value={item.dateTo} onChange={(dateTo) => onChange({ dateTo })} placeholder="2025-01" allowPresent />
            </div>
            <div className="rsb-f">
              <label>location</label>
              <input value={item.location ?? ""} maxLength={120} onChange={(e) => onChange({ location: e.target.value || null })} />
            </div>
          </div>
          <div className="rsb-f">
            <label>bullets · one per line · {item.bullets.length}/{RESUME_LIMITS.bulletsPerItem}</label>
            <textarea
              value={item.bullets.join("\n")}
              onChange={(e) => onChange({ bullets: e.target.value.split("\n").slice(0, RESUME_LIMITS.bulletsPerItem).map((b) => b.slice(0, 400)) })}
              placeholder="Led the thing. Shipped the other thing."
            />
            {item.bullets.length >= RESUME_LIMITS.bulletsPerItem && (
              <span className="rsb-f__hint">{RESUME_LIMITS.bulletsPerItem} bullets max — extra lines are dropped</span>
            )}
          </div>
          <div className="rsb-grid">
            <div className="rsb-f">
              <label>link label</label>
              <input value={item.link?.label ?? ""} maxLength={80} onChange={(e) => onChange({ link: { label: e.target.value, href: item.link?.href ?? "" } })} placeholder="github" />
            </div>
            <div className="rsb-f">
              <label>link url</label>
              <input value={item.link?.href ?? ""} maxLength={500} onChange={(e) => onChange({ link: e.target.value ? { label: item.link?.label ?? "", href: e.target.value } : null })} placeholder="https://…" />
            </div>
          </div>
          {showImage && (
            <div className="rsb-f">
              <label>thumbnail url · shown by the creative template</label>
              <input value={item.image ?? ""} maxLength={500} onChange={(e) => onChange({ image: e.target.value || null })} placeholder="https://… (pulled from the event's first photo)" />
            </div>
          )}
        </div>
      )}
    </Reorder.Item>
  );
}

// ---------- section ----------
function SectionCard({
  section,
  onChange,
  onRemove,
  onAddItem,
  showImage,
}: {
  section: ResumeSection;
  onChange: (patch: Partial<ResumeSection>) => void;
  onRemove: () => void;
  onAddItem: () => void;
  showImage: boolean;
}) {
  const controls = useDragControls();
  const [collapsed, setCollapsed] = useState(false);
  const textual = section.type === "summary" || section.type === "custom";
  const setItems = (items: ResumeItem[]) => onChange({ items });
  const patchItem = (id: string, patch: Partial<ResumeItem>) => setItems(section.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <Reorder.Item
      value={section}
      as="div"
      className={`rsb-sec${section.hidden ? " rsb-sec--hidden" : ""}`}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, boxShadow: "0 16px 40px -14px rgba(0,0,0,0.4)", zIndex: 5 }}
    >
      <div className="rsb-sec__head">
        <DragHandle className="rsb-sec__handle" onStart={(e) => controls.start(e)} />
        <ResumeIconPicker value={section.icon} onChange={(icon) => onChange({ icon })} title="section icon" />
        <div style={{ minWidth: 0 }}>
          <input className="rsb-sec__title" value={section.title} maxLength={80} onChange={(e) => onChange({ title: e.target.value })} aria-label="section title" />
          <div className="rsb-sec__meta" style={{ paddingLeft: 6 }}>
            {SECTION_TITLES[section.type].toLowerCase()}
            {textual ? "" : ` · ${section.items.length} ${section.items.length === 1 ? "item" : "items"}`}
            {section.hidden ? " · hidden" : ""}
          </div>
        </div>
        <div className="rsb-sec__actions">
          <button type="button" className="rsb-ibtn" onClick={() => onChange({ hidden: !section.hidden })} aria-label={section.hidden ? "show section" : "hide section"} aria-pressed={section.hidden} title={section.hidden ? "show on resume" : "hide from resume"}>
            {section.hidden ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4Z" /><circle cx="8" cy="8" r="1.8" /><path d="M3 13L13 3" strokeLinecap="round" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4Z" /><circle cx="8" cy="8" r="1.8" /></svg>
            )}
          </button>
          <button type="button" className="rsb-ibtn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "expand" : "collapse"}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ transform: collapsed ? undefined : "rotate(180deg)", transition: "transform 160ms" }}><path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="rsb-ibtn rsb-ibtn--danger" onClick={onRemove} aria-label="remove section">×</button>
        </div>
      </div>
      <div className={`rsb-sec__body${collapsed ? " rsb-sec__body--collapsed" : ""}`}>
        {textual && (
          <textarea
            className="rsb-sec__text"
            value={section.text ?? ""}
            maxLength={2000}
            onChange={(e) => onChange({ text: e.target.value || null })}
            placeholder={section.type === "summary" ? "two or three sentences on what you do and your strongest work." : "free text for this section (optional)"}
          />
        )}
        {(!textual || section.items.length > 0) && (
          <Reorder.Group as="div" axis="y" values={section.items} onReorder={setItems} className="rsb-items">
            {section.items.map((it) => (
              <ItemCard key={it.id} item={it} showImage={showImage} onChange={(p) => patchItem(it.id, p)} onRemove={() => setItems(section.items.filter((i) => i.id !== it.id))} />
            ))}
          </Reorder.Group>
        )}
        <div className="rsb-sec__foot">
          <button type="button" className="btn btn--ghost btn--small" onClick={onAddItem} disabled={section.items.length >= RESUME_LIMITS.itemsPerSection}>+ add item</button>
          {section.items.length >= RESUME_LIMITS.itemsPerSection && (
            <span className="rsb-f__hint">{RESUME_LIMITS.itemsPerSection} items max per section</span>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

// ---------- editor ----------
export function ResumeEditor({
  initial,
  events,
  username,
  chatEnabled,
  onStateChange,
}: {
  initial: ResumeView | null;
  events: EventDTO[];
  username: string;
  chatEnabled: boolean;
  onStateChange: (s: ResumeEditorState | null) => void;
}) {
  const toast = useToast();
  const [state, setState] = useState<ResumeEditorState | null>(initial ? { doc: initial.document, template: initial.template, pageSize: initial.pageSize, pages: initial.pages } : null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [busy, start] = useTransition();
  const [pull, setPull] = useState(false);
  const [polish, setPolish] = useState<ResumePolish | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const savedSig = useRef(state ? sig(state) : "");
  const pending = useRef<ResumeEditorState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state);
  // signature of the last snapshot the server accepted — set synchronously,
  // before React re-renders with the adopted document
  const lastSavedInput = useRef(state ? sig(state) : "");
  // Saves run one at a time, in order, so an older snapshot can never land
  // after a newer one. Resolves to whether the most recent save succeeded.
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));

  // feed the live preview
  useEffect(() => { latest.current = state; onStateChange(state); }, [state, onStateChange]);

  const runSave = useCallback(async (s: ResumeEditorState): Promise<boolean> => {
    setStatus("saving");
    const res = await saveResumeAction({ document: s.doc, template: s.template, pageSize: s.pageSize, pages: s.pages }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      toast(res?.error ?? "Couldn't save the resume", "error");
      return false;
    }
    lastSavedInput.current = sig(s);
    const stored = { doc: res.data.document, template: res.data.template, pageSize: res.data.pageSize, pages: res.data.pages };
    setState((cur) => {
      if (!cur) return cur;
      if (sig(cur) === sig(s)) {
        // no edits since this snapshot: adopt exactly what the server stored
        // (scrubbed links, reconciled exclusions)
        savedSig.current = sig(stored);
        return stored;
      }
      // newer edits are queued; only carry over the exclusions
      savedSig.current = sig(s);
      return { ...cur, doc: { ...cur.doc, excludedEventIds: res.data.document.excludedEventIds } };
    });
    setStatus((st) => (st === "saving" ? "saved" : st));
    return true;
  }, [toast]);

  const save = useCallback((s: ResumeEditorState): Promise<boolean> => {
    pending.current = null;
    saveChain.current = saveChain.current.then(() => runSave(s));
    return saveChain.current;
  }, [runSave]);

  // autosave — debounced on every change
  useEffect(() => {
    if (!state) return;
    if (sig(state) === savedSig.current) return;
    pending.current = state;
    setStatus("dirty");
    timer.current = setTimeout(() => { timer.current = null; if (pending.current) void save(pending.current); }, 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, save]);

  /** Persist the latest state (retrying a failed save) and wait for every
   *  queued save. False means the server doesn't have the current content. */
  const flush = useCallback(async (): Promise<boolean> => {
    // keep going until the newest state is stored: the owner can still type
    // while a save is in flight (bounded, so constant typing can't spin forever)
    for (let round = 0; round < 5; round++) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      const cur = latest.current;
      const dirty = cur && sig(cur) !== savedSig.current && sig(cur) !== lastSavedInput.current;
      const ok = dirty && cur ? await save(cur) : await saveChain.current;
      if (!ok) return false;
      const now = latest.current ? sig(latest.current) : null;
      if (now === null || now === savedSig.current || now === lastSavedInput.current) return true;
    }
    toast("Still saving your latest edits — try again in a moment.", "error");
    return false;
  }, [save, toast]);

  const adopt = useCallback((view: ResumeView) => {
    const s = { doc: view.document, template: view.template, pageSize: view.pageSize, pages: view.pages };
    savedSig.current = sig(s);
    lastSavedInput.current = savedSig.current;
    pending.current = null;
    setState(s);
    setPublished(view.published);
    setStatus("saved");
  }, []);

  function generate(mode: "merge" | "replace") {
    start(async () => {
      if (!(await flush())) return;
      const res = await generateResumeAction(mode).catch(() => null);
      if (!res?.ok) { toast(res?.error ?? "Couldn't generate the resume", "error"); return; }
      adopt(res.data);
      const fitted = mode === "replace" || !state;
      if (fitted && res.data.notIncluded > 0) {
        const n = res.data.notIncluded;
        toast(`Fitted to ${res.data.pages} ${res.data.pages === 1 ? "page" : "pages"} — ${n} event${n === 1 ? "" : "s"} left out; add ${n === 1 ? "it" : "them"} from the timeline`);
      } else {
        toast(mode === "replace" ? "Started over from your log" : state ? "Synced with your log" : "Resume drafted from your log");
      }
      if (res.data.skipped > 0) {
        toast(`${res.data.skipped} event${res.data.skipped === 1 ? "" : "s"} didn't fit (${RESUME_LIMITS.itemsPerSection} items max per section) — remove some items, then pull them in from the timeline.`, "error");
      }
    });
  }

  function runPolish() {
    if (!state) return;
    start(async () => {
      if (!(await flush())) return;
      const res = await polishResumeAction(latest.current?.doc ?? state.doc).catch(() => null);
      if (!res?.ok) { toast(res?.error ?? "Polish failed", "error"); return; }
      setPolish(res.data);
    });
  }

  function togglePublish(next: boolean) {
    start(async () => {
      if (!(await flush())) return; // never publish content the server doesn't have
      const res = await setResumePublishedAction(next).catch(() => null);
      if (!res?.ok) { toast(res?.error ?? "Couldn't update", "error"); return; }
      setPublished(res.data.published);
      toast(res.data.published ? "Resume published" : "Resume unpublished");
    });
  }

  async function download() {
    // open synchronously (inside the click) so popup blockers allow it
    const win = window.open("", "_blank");
    if (!(await flush())) { win?.close(); return; }
    if (win) { win.opener = null; win.location.href = "/dashboard/resume/print"; }
    else window.location.href = "/dashboard/resume/print";
  }

  const publicUrl = `${SITE_URL}/${username}/resume`;
  const host = new URL(SITE_URL).hostname;

  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { toast("Couldn't copy", "error"); }
  }

  // ---- document helpers ----
  const setDoc = (fn: (d: ResumeDocument) => ResumeDocument) => setState((s) => (s ? { ...s, doc: fn(s.doc) } : s));
  const patchHeader = (p: Partial<ResumeDocument["header"]>) => setDoc((d) => ({ ...d, header: { ...d.header, ...p } }));
  const patchSection = (id: string, p: Partial<ResumeSection>) => setDoc((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const removeSection = (id: string) => setDoc((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }));
  const addSection = (type: SectionType) => {
    setDoc((d) => ({
      ...d,
      sections: [...d.sections, { id: newResumeId("sec"), type, title: SECTION_TITLES[type], icon: SECTION_DEFAULT_ICON[type] ?? null, hidden: false, text: null, items: [] }],
    }));
    setAddOpen(false);
  };
  const addItem = (sectionId: string) =>
    patchSectionItems(sectionId, (items) => [
      ...items,
      { id: newResumeId("it"), eventId: null, title: "", subtitle: null, location: null, dateFrom: null, dateTo: null, bullets: [], link: null, icon: null, image: null },
    ]);
  const patchSectionItems = (sectionId: string, fn: (items: ResumeItem[]) => ResumeItem[]) =>
    setDoc((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sectionId ? { ...s, items: fn(s.items) } : s)) }));

  const pullIn = (picked: PullResult) => {
    if (!picked.length) return;
    // computed outside the updater: strict mode runs updaters twice, which
    // would double-count `added`
    const d = latest.current?.doc;
    if (!d) return;
    let added = 0;
    const next = (() => {
      const sections = d.sections.map((s) => ({ ...s, items: [...s.items] }));
      const pulled = new Set<string>();
      for (const { item, sectionType } of picked) {
        let target = sections.find((s) => s.type === sectionType);
        if (!target) {
          if (sections.length >= RESUME_LIMITS.sections) continue; // can't open a new section
          target = { id: newResumeId("sec"), type: sectionType, title: SECTION_TITLES[sectionType], icon: SECTION_DEFAULT_ICON[sectionType] ?? null, hidden: false, text: null, items: [] };
          sections.push(target);
        }
        if (target.items.length >= RESUME_LIMITS.itemsPerSection) continue; // section full
        target.items.push(item);
        if (item.eventId) pulled.add(item.eventId);
        added += 1;
      }
      return { ...d, sections, excludedEventIds: d.excludedEventIds.filter((id) => !pulled.has(id)) };
    })();
    setDoc(() => next);
    const skipped = picked.length - added;
    toast(skipped ? `Added ${added}, skipped ${skipped} (section full)` : `Added ${added} ${added === 1 ? "event" : "events"}`, skipped ? "error" : "success");
  };

  const applyPolishReviewed = (accepted: ResumePolish, template: ResumeTemplate | null) => {
    setState((s) => (s ? { ...s, doc: applyPolish(s.doc, accepted), template: template ?? s.template } : s));
    toast("Polish applied");
  };

  const sections = useMemo(() => state?.doc.sections ?? [], [state]);
  const availableTypes = useMemo(() => SECTION_TYPES.filter((t) => t === "custom" || !sections.some((s) => s.type === t)), [sections]);
  const sectionsFull = sections.length >= RESUME_LIMITS.sections;
  // room left for pulled events, per target section type (a missing section
  // can still be created unless the section cap is hit)
  const pullCapacity = useMemo(() => {
    const cap: Partial<Record<SectionType, number>> = {};
    for (const t of SECTION_TYPES) {
      const existing = sections.find((s) => s.type === t);
      cap[t] = existing ? RESUME_LIMITS.itemsPerSection - existing.items.length : sectionsFull ? 0 : RESUME_LIMITS.itemsPerSection;
    }
    return cap as Record<SectionType, number>;
  }, [sections, sectionsFull]);
  const onResume = useMemo(() => new Set(sections.flatMap((s) => s.items.map((i) => i.eventId))), [sections]);
  const pullFull = useMemo(
    () => events.filter((e) => !onResume.has(e.id)).every((e) => (pullCapacity[sectionTypeForTags(e.tags)] ?? 0) <= 0),
    [events, onResume, pullCapacity]
  );

  // ---- empty state ----
  if (!state) {
    return (
      <section role="tabpanel">
        <div className="card">
          <div className="card__head">
            <span className="card__head__title">resume <span className="accent">/</span> built from your log</span>
          </div>
          <div className="rsb-empty">
            <h3 className="rsb-empty__title">one click, one resume<span className="colon">.</span></h3>
            <p className="rsb-empty__sub">
              your log already holds the dates, the roles and the wins. draft a resume from it, pick a template, drag things around, then download a PDF or publish it at {host}/{username}/resume.
            </p>
            <div className="rsb-empty__actions">
              <button type="button" className="btn btn--primary" onClick={() => generate("merge")} disabled={busy}>
                {busy ? "drafting…" : "draft my resume →"}
              </button>
              <span className="field__hint">{events.length} {events.length === 1 ? "event" : "events"} on your timeline</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { doc, template, pageSize, pages } = state;

  return (
    <section role="tabpanel">
      {/* toolbar */}
      <div className="card">
        <div className="card__head">
          <span className="card__head__title">resume <span className="accent">/</span> a projection of your log</span>
          <span className={`rsb-status rsb-status--${status}`}>
            <span className="rsb-status__dot" />
            {status === "saved" ? "saved" : status === "saving" ? "saving…" : status === "dirty" ? "unsaved" : "save failed"}
          </span>
        </div>

        <div className="rsb-toolbar">
          <button type="button" className="btn" onClick={() => generate("merge")} disabled={busy} title="add new events from the log, drop deleted ones, keep your edits">
            {busy ? "working…" : "↻ sync from log"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)} disabled={busy}>start over</button>
          {chatEnabled && (
            <button type="button" className="btn" onClick={runPolish} disabled={busy} title="AI rewrites bullets + summary from your log — you review every change">
              ✦ polish with AI
            </button>
          )}
          <span className="rsb-toolbar__spacer" />
          <button type="button" className="btn btn--primary" onClick={download} disabled={busy}>download pdf ↓</button>
        </div>

        {/* publish */}
        <div className="rsb-publish">
          <Switch on={published} onChange={togglePublish} label={published ? "published" : "private"} disabled={busy} />
          <div className="rsb-publish__copy">
            <span className="rsb-publish__title">{published ? "live — anyone with the link can read it" : "only you can see it"}</span>
            <span className="rsb-publish__url">
              {host}<span className="accent">/</span>{username}<span className="accent">/</span>resume
            </span>
          </div>
          <div className="rsb-publish__actions">
            <button type="button" className="btn btn--small" onClick={copyLink}>{copied ? "copied ✓" : "copy link"}</button>
            {published && (
              <a className="btn btn--small" href={`/${username}/resume`} target="_blank" rel="noopener noreferrer">open ↗</a>
            )}
          </div>
        </div>

        {/* template */}
        <div className="field">
          <span className="field__label">template</span>
          <div className="rsb-templates">
            {RESUME_TEMPLATES.map((t) => (
              <button key={t} type="button" className="rsb-tpl" aria-current={template === t} onClick={() => setState((s) => (s ? { ...s, template: t } : s))}>
                <span className="rsb-tpl__thumb" data-t={t} aria-hidden="true">
                  <i className="a" /><i /><i className="w" /><i /><i className="w" />
                </span>
                <span className="rsb-tpl__name">{TEMPLATE_META[t].name}</span>
                <span className="rsb-tpl__note">{TEMPLATE_META[t].note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field-row rsb-pagerow">
          <div className="field">
            <span className="field__label">pages · target length</span>
            <div className="rsb-seg" role="radiogroup" aria-label="number of pages">
              {RESUME_PAGE_COUNTS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={pages === n} aria-current={pages === n} onClick={() => setState((s) => (s ? { ...s, pages: n } : s))}>
                  {n}
                </button>
              ))}
            </div>
            <span className="field__hint">the preview tightens to fit; &ldquo;start over&rdquo; re-picks events for this length</span>
          </div>
          <div className="field">
            <span className="field__label">page size</span>
            <div className="rsb-seg" role="radiogroup" aria-label="page size">
              {RESUME_PAGE_SIZES.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={pageSize === p} aria-current={pageSize === p} onClick={() => setState((s) => (s ? { ...s, pageSize: p } : s))}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field__label">photo</span>
            <Switch on={doc.header.showAvatar} onChange={(v) => patchHeader({ showAvatar: v })} label={doc.header.avatarUrl ? (doc.header.showAvatar ? "shown (not on classic)" : "hidden") : "no avatar on your profile"} disabled={!doc.header.avatarUrl} />
          </div>
        </div>

        <div className="field">
          <span className="field__label">accent</span>
          <div className="rsb-accents">
            <button type="button" className="rsb-accent rsb-accent--auto" aria-current={doc.accent === null} onClick={() => setDoc((d) => ({ ...d, accent: null }))} title="your profile's accent" aria-label="use the profile accent" />
            {ACCENT_SWATCHES.map((hex) => (
              <button key={hex} type="button" className="rsb-accent" style={{ background: hex }} aria-current={doc.accent?.toLowerCase() === hex.toLowerCase()} onClick={() => setDoc((d) => ({ ...d, accent: hex }))} aria-label={hex} />
            ))}
            <span className="rsb-accent rsb-accent--custom" style={{ background: doc.accent ?? "var(--user-accent)" }} title="custom">
              <input type="color" value={doc.accent ?? "#d85a30"} onChange={(e) => setDoc((d) => ({ ...d, accent: e.target.value }))} aria-label="custom accent" />
            </span>
          </div>
        </div>
      </div>

      {/* header */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="card__head">
          <span className="card__head__title">header <span className="accent">/</span> who this is</span>
        </div>
        <div className="rsb-header">
          <div className="rsb-grid">
            <div className="rsb-f"><label>name</label><input value={doc.header.name} maxLength={120} onChange={(e) => patchHeader({ name: e.target.value })} /></div>
            <div className="rsb-f"><label>headline</label><input value={doc.header.headline} maxLength={200} onChange={(e) => patchHeader({ headline: e.target.value })} placeholder="building X at Y" /></div>
          </div>
          <div className="rsb-grid">
            <div className="rsb-f"><label>location</label><input value={doc.header.location} maxLength={120} onChange={(e) => patchHeader({ location: e.target.value })} /></div>
            <div className="rsb-f"><label>email</label><input value={doc.header.email ?? ""} maxLength={200} onChange={(e) => patchHeader({ email: e.target.value || null })} placeholder="you@example.com" /></div>
          </div>
          <div className="rsb-f">
            <label>links</label>
            <div className="rsb-links">
              {doc.header.links.map((l, i) => (
                <div key={i} className="rsb-link-row">
                  <ResumeIconPicker value={l.icon} onChange={(icon) => patchHeader({ links: doc.header.links.map((x, j) => (j === i ? { ...x, icon } : x)) })} size={30} title="link icon" />
                  <input value={l.label} maxLength={80} placeholder="label" aria-label="link label" onChange={(e) => patchHeader({ links: doc.header.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input value={l.href} maxLength={500} placeholder="https://…" aria-label="link url" onChange={(e) => patchHeader({ links: doc.header.links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} />
                  <button type="button" className="rsb-ibtn rsb-ibtn--danger" aria-label="remove link" onClick={() => patchHeader({ links: doc.header.links.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
              <div>
                <button type="button" className="btn btn--ghost btn--small" disabled={doc.header.links.length >= RESUME_LIMITS.headerLinks} onClick={() => patchHeader({ links: [...doc.header.links, { label: "", href: "", icon: "lucide:link" }] })}>+ add link</button>
              </div>
            </div>
            <span className="rsb-f__hint">
              {doc.header.links.length >= RESUME_LIMITS.headerLinks ? `${RESUME_LIMITS.headerLinks} links max · ` : ""}only http(s) and mailto links are kept
            </span>
          </div>
        </div>
      </div>

      {/* sections */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="card__head">
          <span className="card__head__title">sections <span className="accent">/</span> drag to reorder · click a title to rename</span>
        </div>
        <Reorder.Group as="div" axis="y" values={sections} onReorder={(next) => setDoc((d) => ({ ...d, sections: next }))} className="rsb-sections">
          {sections.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              showImage={template === "creative"}
              onChange={(p) => patchSection(s.id, p)}
              onRemove={() => removeSection(s.id)}
              onAddItem={() => addItem(s.id)}
            />
          ))}
        </Reorder.Group>
        {sections.length === 0 && <p className="rsb-dialog__empty">no sections yet — add one, or pull events from your timeline.</p>}

        <div className="rsb-toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
          <div className="rsb-add">
            <button type="button" className="btn" onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen} disabled={sectionsFull}>+ add section</button>
            {addOpen && (
              <div className="rsb-menu" role="menu">
                {availableTypes.map((t) => (
                  <button key={t} type="button" role="menuitem" onClick={() => addSection(t)}>
                    <ResumeIcon icon={SECTION_DEFAULT_ICON[t]} size={13} />
                    {SECTION_TITLES[t]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="btn" onClick={() => setPull(true)} disabled={pullFull}>⤓ pull from timeline</button>
          {(sectionsFull || pullFull) && (
            <span className="rsb-f__hint">
              {sectionsFull ? `${RESUME_LIMITS.sections} sections max` : ""}
              {sectionsFull && pullFull ? " · " : ""}
              {pullFull ? "every section an event could land in is full" : ""}
            </span>
          )}
        </div>
      </div>

      {pull && <ResumePullDialog events={events} doc={doc} capacity={pullCapacity} onClose={() => setPull(false)} onAdd={pullIn} />}
      {polish && <ResumePolishDialog doc={doc} polish={polish} currentTemplate={template} onClose={() => setPolish(null)} onApply={applyPolishReviewed} />}
      {confirmReset && (
        <Dialog onClose={() => setConfirmReset(false)} label="start over">
          <h2 className="modal__title">start over<span className="colon">?</span></h2>
          <p style={{ color: "var(--muted)", margin: "10px 0 18px" }}>
            rebuilds the resume from your log and discards every edit — section order, titles, bullets, icons. template, page size and publish state stay.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)}>keep my edits</button>
            <button type="button" className="btn btn--danger" onClick={() => { setConfirmReset(false); generate("replace"); }}>start over</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
