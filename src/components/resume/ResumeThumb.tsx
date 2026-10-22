"use client";

// A live thumbnail of the owner's own resume in a given template (#69):
// the real ResumeSheet scaled down and clipped to its first page. Purely
// decorative — pointer events off, hidden from assistive tech.

import type { ResumeDocument, ResumePageCount, ResumePageSize, ResumeTemplate } from "@/lib/resume";
import { PAGE_DIMENSIONS } from "@/lib/resume-format";
import type { Theme } from "@/lib/theme";
import { ResumeSheet } from "./ResumeSheet";

export function ResumeThumb({
  doc,
  template,
  pageSize,
  pages,
  theme,
  width = 112,
}: {
  doc: ResumeDocument;
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  pages: ResumePageCount;
  theme: Theme;
  width?: number;
}) {
  const dim = PAGE_DIMENSIONS[pageSize].px;
  const scale = width / dim.width;
  return (
    <span className="rsb-thumb" style={{ width, height: dim.height * scale }} aria-hidden="true">
      <span className="rsb-thumb__stage" style={{ width: dim.width, height: dim.height, transform: `scale(${scale})` }}>
        <ResumeSheet doc={doc} template={template} pageSize={pageSize} pages={pages} theme={theme} />
      </span>
    </span>
  );
}
