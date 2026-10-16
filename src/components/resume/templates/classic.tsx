// classic — ATS-safe. One column, real text only: no icons, no images, no
// multi-column grids, plain bold headings a parser can read top-to-bottom.
// Entry line is "Role · Organisation" with the date on the right (#69);
// skills and links are one wrapping line, not one bullet each.

import { visibleSections } from "@/lib/resume-format";
import { Bullets, ContactBits, DateRange, ItemLink, SectionText, type TemplateProps } from "./shared";

const INLINE_TYPES = new Set(["skills", "links"]);

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
          {INLINE_TYPES.has(s.type) && s.items.length > 0 ? (
            <article className="r-classic__item">
              <p className="r-classic__inline">
                {s.items.map((it, i) => (
                  <span key={it.id}>
                    {i > 0 && ", "}
                    {it.link ? <ItemLink link={{ ...it.link, label: it.title }} className="r-classic__inline-a" /> : it.title}
                  </span>
                ))}
              </p>
            </article>
          ) : (
            s.items.map((it) => (
              <article key={it.id} className="r-classic__item">
                <div className="r-classic__row">
                  <p className="r-classic__title">
                    <strong>{it.title}</strong>
                    {it.subtitle && <span className="r-classic__org"> · {it.subtitle}</span>}
                    {it.location && <span className="r-classic__loc">, {it.location}</span>}
                  </p>
                  <DateRange item={it} className="r-classic__date" />
                </div>
                <Bullets bullets={it.bullets} />
                {it.link && (
                  <p className="r-classic__link">
                    <ItemLink link={it.link} />
                  </p>
                )}
              </article>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
