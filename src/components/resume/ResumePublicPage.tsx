import Link from "next/link";
import type { CSSProperties } from "react";
import { Mark } from "@/components/Mark";
import { PALETTES, themeCssVars } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import type { ProfileDTO } from "@/lib/profile";
import type { ResumeView } from "@/lib/resume-data";
import { ResumePrintStyle, ResumeSheet } from "./ResumeSheet";
import { PrintButton } from "./PrintButton";

/** /[username]/resume — the published resume on the owner's palette, with
 *  a download (print-to-PDF) button. Server component; only the button is client. */
export function ResumePublicPage({ profile, resume }: { profile: ProfileDTO; resume: ResumeView }) {
  const vars = themeCssVars(profile.theme) as CSSProperties;
  const dark = PALETTES[profile.theme.palette]?.dark;
  const host = new URL(SITE_URL).hostname;
  return (
    <div className="logr resume-public" data-mode={dark ? "dark" : "light"} style={vars}>
      <ResumePrintStyle pageSize={resume.pageSize} />
      <header className="bar">
        <div className="bar__inner">
          <span className="bar__brand">
            <Link href="/"><Mark />logr</Link>
          </span>
          <nav className="bar__util" aria-label="utilities">
            <Link href={`/${profile.username}`}>
              <span className="bar__util__label">timeline</span>
            </Link>
            <PrintButton className="btn-print" />
          </nav>
        </div>
      </header>

      <div className="resume-public__body">
        <p className="resume-public__meta">
          <span>
            {host}<span className="accent">/</span>{profile.username}<span className="accent">/</span>resume
          </span>
          <span>
            built from <Link href={`/${profile.username}`}>{profile.name.toLowerCase()}&apos;s log</Link> · {resume.template}
          </span>
        </p>
        <div className="resume-public__sheet">
          <ResumeSheet doc={resume.document} template={resume.template} pageSize={resume.pageSize} pages={resume.pages} theme={profile.theme} id="resume" />
        </div>
        <PrintButton />
      </div>
    </div>
  );
}
