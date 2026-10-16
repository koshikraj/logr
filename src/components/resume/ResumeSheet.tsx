"use client";

// The resume "sheet": picks a template, sizes the page, injects the theme
// tokens (fonts, palette accent) with the document's accent override on top,
// and fits the content to the target page count (#68). Shared by the public
// page, the dashboard preview, and print, so all three paginate the same.

import { useCallback, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { ResumeDocument, ResumePageCount, ResumePageSize, ResumeTemplate } from "@/lib/resume";
import { resolvePalette, themeCssVars, type Theme } from "@/lib/theme";
import { FIT_STEPS, PAGE_DIMENSIONS } from "@/lib/resume-format";
import { ClassicTemplate } from "./templates/classic";
import { ModernTemplate } from "./templates/modern";
import { FounderTemplate } from "./templates/founder";
import { AcademicTemplate } from "./templates/academic";
import { CreativeTemplate } from "./templates/creative";

export const TEMPLATE_META: Record<ResumeTemplate, { name: string; note: string }> = {
  classic: { name: "classic", note: "ATS-safe · one column, no icons" },
  modern: { name: "modern", note: "two columns · accent sidebar" },
  founder: { name: "founder", note: "projects first · card grid" },
  academic: { name: "academic", note: "dense · numbered entries" },
  creative: { name: "creative", note: "bold · image thumbnails" },
};

const TEMPLATES: Record<ResumeTemplate, (p: { doc: ResumeDocument }) => React.ReactElement> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  founder: FounderTemplate,
  academic: AcademicTemplate,
  creative: CreativeTemplate,
};

export function resumeSheetVars(theme: Theme, accent: string | null): CSSProperties {
  const palette = resolvePalette(theme);
  return {
    ...(themeCssVars(theme) as CSSProperties),
    ["--r-accent" as string]: accent ?? theme.accentOverride ?? palette.accent,
  };
}

/** What the fit pass found: pages the content occupies after tightening,
 *  whether that is within the target, and which step of the ladder it took. */
export type ResumeFit = { usedPages: number; target: number; fits: boolean; step: number; heightPx: number };

/**
 * Fit-to-target. Runs synchronously in a layout effect so there is no
 * flicker: the sheet is measured at each step of FIT_STEPS (spacing first,
 * then margins, then type — see resume-format.ts) and stops at the first
 * step whose height is within `pages × page height`. If none fits, the
 * last step (the readability floor) stays applied and `fits` is false.
 * The step is written straight to the DOM (`data-fit`) rather than React
 * state, so SSR markup is step 0 and the client settles in one paint.
 */
export function ResumeSheet({
  doc,
  template,
  pageSize,
  pages = 2,
  theme,
  id,
  onFit,
}: {
  doc: ResumeDocument;
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  pages?: ResumePageCount;
  theme: Theme;
  id?: string;
  onFit?: (fit: ResumeFit) => void;
}) {
  const Template = TEMPLATES[template] ?? ModernTemplate;
  const ref = useRef<HTMLElement>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;

  const run = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pageH = PAGE_DIMENSIONS[pageSize].px.height;
    const budget = pages * pageH + 2; // tolerance for sub-pixel rounding
    let step = 0;
    let height = 0;
    for (step = 0; step < FIT_STEPS.length; step++) {
      el.dataset.fit = String(step);
      height = el.offsetHeight; // forces layout at this step; offsetHeight ignores ancestor transforms
      if (height <= budget) break;
    }
    if (step === FIT_STEPS.length) step = FIT_STEPS.length - 1; // floor reached
    const usedPages = Math.max(1, Math.ceil((height - 2) / pageH));
    onFitRef.current?.({ usedPages, target: pages, fits: height <= budget, step, heightPx: height });
  }, [pageSize, pages]);

  // re-fit on every content/setting change, and again once web fonts land
  // (metrics change line wrapping, which changes the height)
  useLayoutEffect(() => {
    run();
    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => { if (!cancelled) run(); });
    }
    return () => { cancelled = true; };
  }, [run, doc, template]);

  return (
    <article
      ref={ref}
      id={id}
      className="resume"
      data-template={template}
      data-page={pageSize}
      data-pages={pages}
      style={resumeSheetVars(theme, doc.accent)}
    >
      <div className="resume__body">
        <Template doc={doc} />
      </div>
    </article>
  );
}

/** `@page` can't read CSS variables, so the size is emitted per render. */
export function ResumePrintStyle({ pageSize }: { pageSize: ResumePageSize }) {
  const dim = PAGE_DIMENSIONS[pageSize];
  return <style>{`@page { size: ${dim.width} ${dim.height}; margin: 0; }`}</style>;
}
