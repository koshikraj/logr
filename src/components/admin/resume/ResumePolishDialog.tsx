"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { TEMPLATE_META } from "@/components/resume/ResumeSheet";
import type { ResumeDocument, ResumePolish, ResumeTemplate } from "@/lib/resume";

/** Review an AI polish proposal change by change. Only the accepted parts
 *  are applied (via applyPolish in the editor); nothing is saved from here. */
export function ResumePolishDialog({
  doc,
  polish,
  currentTemplate,
  onClose,
  onApply,
}: {
  doc: ResumeDocument;
  polish: ResumePolish;
  currentTemplate: ResumeTemplate;
  onClose: () => void;
  onApply: (accepted: ResumePolish, template: ResumeTemplate | null) => void;
}) {
  const items = useMemo(() => {
    const byId = new Map(doc.sections.flatMap((s) => s.items.map((i) => [i.id, { item: i, section: s.title }] as const)));
    return Object.entries(polish.bullets)
      .map(([id, bullets]) => {
        const hit = byId.get(id);
        return hit ? { id, bullets, item: hit.item, section: hit.section } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x && JSON.stringify(x.bullets) !== JSON.stringify(x.item.bullets));
  }, [doc, polish]);

  const summarySection = doc.sections.find((s) => s.type === "summary");
  const summaryChanged = !!polish.summary && polish.summary !== (summarySection?.text ?? "");
  const templateChanged = polish.template !== currentTemplate;

  const [acceptSummary, setAcceptSummary] = useState(summaryChanged);
  const [acceptTemplate, setAcceptTemplate] = useState(templateChanged);
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const nothing = !summaryChanged && !templateChanged && items.length === 0;
  const count = (acceptSummary ? 1 : 0) + (acceptTemplate ? 1 : 0) + accepted.size;

  function toggle(id: string) {
    setAccepted((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function apply() {
    const bullets: Record<string, string[]> = {};
    for (const it of items) if (accepted.has(it.id)) bullets[it.id] = it.bullets;
    onApply({ summary: acceptSummary ? polish.summary : null, template: polish.template, bullets }, acceptTemplate ? polish.template : null);
    onClose();
  }

  return (
    <Dialog onClose={onClose} variant="wide" label="review AI polish">
      <div className="emodal__head">
        <div>
          <h2 className="modal__title">polish<span className="colon">.</span></h2>
          <p className="emodal__sub">reworded from your log and your own edits — no new facts added. untick anything you&apos;d rather keep as is.</p>
        </div>
        <button type="button" className="emodal__close" onClick={onClose} aria-label="close">×</button>
      </div>

      <div className="rsb-polish">
        {nothing && <p className="rsb-dialog__empty">the AI had no changes to suggest — your resume already reads well.</p>}

        {templateChanged && (
          <label className="rsb-polish__block">
            <Check on={acceptTemplate} onChange={setAcceptTemplate} />
            <div>
              <div className="rsb-polish__label">template</div>
              <div className="rsb-polish__after">
                switch to <strong>{polish.template}</strong> <span style={{ color: "var(--muted)" }}>— {TEMPLATE_META[polish.template].note}</span>
              </div>
            </div>
          </label>
        )}

        {summaryChanged && (
          <label className="rsb-polish__block">
            <Check on={acceptSummary} onChange={setAcceptSummary} />
            <div>
              <div className="rsb-polish__label">summary</div>
              {summarySection?.text && <div className="rsb-polish__before">{summarySection.text}</div>}
              <div className="rsb-polish__after">{polish.summary}</div>
            </div>
          </label>
        )}

        {items.map((it) => (
          <label key={it.id} className="rsb-polish__block">
            <Check on={accepted.has(it.id)} onChange={() => toggle(it.id)} />
            <div>
              <div className="rsb-polish__label">{it.section} · {it.item.title}</div>
              {it.item.bullets.length > 0 && (
                <div className="rsb-polish__before">
                  <ul>{it.item.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                </div>
              )}
              <div className="rsb-polish__after">
                <ul>{it.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="emodal__foot">
        <span className="emodal__esc">esc to close</span>
        <button type="button" className="btn btn--ghost" onClick={onClose}>cancel</button>
        <button type="button" className="btn btn--primary" onClick={apply} disabled={count === 0}>
          apply {count || ""} {count === 1 ? "change" : "changes"} →
        </button>
      </div>
    </Dialog>
  );
}

function Check({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="rsb-pick" style={{ display: "contents" }} aria-checked={on} role="checkbox">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
      <span className="rsb-pick__box" aria-hidden="true" style={{ marginTop: 3 }}>
        {on && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </span>
    </span>
  );
}
