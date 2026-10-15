// The resume "sheet": picks a template, sizes the page, and injects the
// theme tokens (fonts, palette accent) with the document's accent override
// on top. Shared by the public page, the dashboard preview, and print.

import type { CSSProperties } from "react";
import type { ResumeDocument, ResumePageSize, ResumeTemplate } from "@/lib/resume";
import { resolvePalette, themeCssVars, type Theme } from "@/lib/theme";
import { PAGE_DIMENSIONS } from "@/lib/resume-format";
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

export function ResumeSheet({
  doc,
  template,
  pageSize,
  theme,
  id,
}: {
  doc: ResumeDocument;
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  theme: Theme;
  id?: string;
}) {
  const Template = TEMPLATES[template] ?? ModernTemplate;
  return (
    <article id={id} className="resume" data-template={template} data-page={pageSize} style={resumeSheetVars(theme, doc.accent)}>
      <Template doc={doc} />
    </article>
  );
}

/** `@page` can't read CSS variables, so the size is emitted per render. */
export function ResumePrintStyle({ pageSize }: { pageSize: ResumePageSize }) {
  const dim = PAGE_DIMENSIONS[pageSize];
  return <style>{`@page { size: ${dim.width} ${dim.height}; margin: 0; }`}</style>;
}
