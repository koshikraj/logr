// classic — ATS-safe. One column, real text only: no icons, no images, no
// multi-column grids, plain headings a parser can read top-to-bottom.

import { visibleSections } from "@/lib/resume-format";
import { Bullets, ContactBits, DateRange, ItemLink, SectionText, type TemplateProps } from "./shared";

export function ClassicTemplate({ doc }: TemplateProps) {
  const h = doc.header;
  return (
    <div className="r-classic">
      <header className="r-classic__head">
        <h1 className="r-classic__name">{h.name}</h1>
        {h.headline && <p className="r-classic__headline">{h.headline}</p>}
        <ContactBits doc={doc} />
      </header>

      {visibleSections(doc).map((s) => (
        <section key={s.id} className="r-classic__sec">
          <h2 className="r-classic__h">{s.title}</h2>
          <SectionText section={s} />
          {s.items.map((it) => (
            <article key={it.id} className="r-classic__item">
              <div className="r-classic__row">
                <strong className="r-classic__title">{it.title}</strong>
                <DateRange item={it} className="r-classic__date" />
              </div>
              {(it.subtitle || it.location) && (
                <p className="r-classic__sub">
                  {it.subtitle}
                  {it.subtitle && it.location ? " · " : ""}
                  {it.location}
                </p>
              )}
              <Bullets bullets={it.bullets} />
              {it.link && (
                <p className="r-classic__link">
                  <ItemLink link={it.link} />
                </p>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
