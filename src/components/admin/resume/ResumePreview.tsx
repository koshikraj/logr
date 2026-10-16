"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResumeSheet, type ResumeFit } from "@/components/resume/ResumeSheet";
import { FIT_STEPS, PAGE_DIMENSIONS } from "@/lib/resume-format";
import type { ResumeDocument, ResumePageCount, ResumePageSize, ResumeTemplate } from "@/lib/resume";
import type { Theme } from "@/lib/theme";

/** Live preview: the real sheet, scaled to fit the pane, with dashed page
 *  breaks drawn at every page height. The sheet fits itself to the target
 *  page count; the label reports "N of M pages" and warns when it still
 *  runs over at the readability floor. */
export function ResumePreview({
  doc,
  template,
  pageSize,
  pages,
  theme,
}: {
  doc: ResumeDocument;
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  pages: ResumePageCount;
  theme: Theme;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  const [fit, setFit] = useState<ResumeFit | null>(null);
  const dim = PAGE_DIMENSIONS[pageSize].px;

  // fit-to-width — observe the pane, scale the fixed-size sheet to it
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setScale(Math.min(1, (w - 8) / dim.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dim.width]);

  // sheet height drives the stage size + break markers
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onFit = useCallback((f: ResumeFit) => setFit(f), []);

  const used = fit?.usedPages ?? Math.max(1, Math.ceil((height - 2) / dim.height));
  const over = fit ? !fit.fits : used > pages;
  const tightened = (fit?.step ?? 0) > 0;
  const breaks = Array.from({ length: used - 1 }, (_, i) => (i + 1) * dim.height);

  return (
    <div className="rsb-preview" ref={wrapRef}>
      <p className={`rsb-preview__pages${over ? " rsb-preview__pages--over" : ""}`} aria-live="polite">
        <span className="rsb-preview__count">
          <span className="accent">{template}</span> · {pageSize} ·{" "}
          <strong>
            {used} of {pages} {pages === 1 ? "page" : "pages"}
          </strong>
          {tightened && !over && (
            <span className="rsb-preview__fit" title={`fit step ${fit!.step} of ${FIT_STEPS.length - 1}: spacing, margins, then type (floor ≈ 9.5pt)`}>
              · tightened {fit!.step === FIT_STEPS.length - 1 ? "to the floor" : `${fit!.step}/${FIT_STEPS.length - 1}`}
            </span>
          )}
        </span>
        {over && <span className="rsb-preview__hint">over the target even at the smallest readable size — remove or hide items, or choose more pages</span>}
      </p>
      <div className="rsb-preview__stage" style={{ transform: `scale(${scale})`, width: dim.width, height: Math.max(height, dim.height) * scale, marginBottom: 0 }}>
        <div className="rsb-preview__sheet" ref={sheetRef} style={{ width: dim.width }}>
          <ResumeSheet doc={doc} template={template} pageSize={pageSize} pages={pages} theme={theme} onFit={onFit} />
          <div className="rsb-preview__breaks" aria-hidden="true">
            {breaks.map((y, i) => (
              <span key={y} className={`rsb-preview__break${i + 2 > pages ? " rsb-preview__break--over" : ""}`} style={{ top: y }} data-label={i + 2 > pages ? `page ${i + 2} · over` : `page ${i + 2}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
