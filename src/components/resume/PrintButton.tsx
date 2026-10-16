"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ResumeDocument, ResumePageCount, ResumePageSize, ResumeTemplate } from "@/lib/resume";
import type { Theme } from "@/lib/theme";
import { ResumeSheet } from "./ResumeSheet";

/** "Download PDF" = the browser's print-to-PDF. The print stylesheet hides
 *  everything but the sheet and sizes the page, so the text stays selectable. */
export function PrintButton({ className = "btn-print btn-print--primary", label = "download pdf" }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <path d="M8 2.5v8M8 10.5L5 7.5M8 10.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 11v2.5h10V11" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}

/** Owner print route: renders the sheet and opens the print dialog once the
 *  fit pass has settled (after web fonts), so the PDF paginates like the preview. */
export function ResumePrintView({
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
  const printed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFit = useCallback(() => {
    // the sheet re-fits once fonts are ready; print after the last call settles
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (printed.current) return;
      printed.current = true;
      window.print();
    }, 400);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <ResumeSheet doc={doc} template={template} pageSize={pageSize} pages={pages} theme={theme} id="resume" onFit={onFit} />;
}
