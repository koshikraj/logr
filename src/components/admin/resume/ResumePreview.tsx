"use client";

import { useEffect, useRef, useState } from "react";
import { ResumeSheet } from "@/components/resume/ResumeSheet";
import { PAGE_DIMENSIONS } from "@/lib/resume-format";
import type { ResumeDocument, ResumePageSize, ResumeTemplate } from "@/lib/resume";
import type { Theme } from "@/lib/theme";

/** Live preview: the real sheet, scaled to fit the pane, with dashed page
 *  breaks drawn at every page height so pagination is visible while editing. */
export function ResumePreview({ doc, template, pageSize, theme }: { doc: ResumeDocument; template: ResumeTemplate; pageSize: ResumePageSize; theme: Theme }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
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

  // sheet height drives the page count + break markers
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil((height - 2) / dim.height));
  const breaks = Array.from({ length: pages - 1 }, (_, i) => (i + 1) * dim.height);

  return (
    <div className="rsb-preview" ref={wrapRef}>
      <p className="rsb-preview__pages">
        <span className="accent">{template}</span> · {pageSize} · {pages} {pages === 1 ? "page" : "pages"}
      </p>
      <div className="rsb-preview__stage" style={{ transform: `scale(${scale})`, width: dim.width, height: Math.max(height, dim.height) * scale, marginBottom: 0 }}>
        <div className="rsb-preview__sheet" ref={sheetRef} style={{ width: dim.width }}>
          <ResumeSheet doc={doc} template={template} pageSize={pageSize} theme={theme} />
          <div className="rsb-preview__breaks" aria-hidden="true">
            {breaks.map((y, i) => (
              <span key={y} className="rsb-preview__break" style={{ top: y }} data-label={`page ${i + 2}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
