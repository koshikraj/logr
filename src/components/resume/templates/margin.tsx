// margin — moderncv "banking" style (#69). One reading column with the dates
// in a 30mm left margin on every section; no cards, icons, sidebar or photo,
// so it stays ATS-safe and suits dense two-page senior CVs.

import { visibleSections } from "@/lib/resume-format";
import { Bullets, ContactBits, DateRange, ItemLink, SectionText, type TemplateProps } from "./shared";

const INLINE_TYPES = new Set(["skills", "links"]);

export function MarginTemplate({ doc }: TemplateProps) {
  const h = doc.header;
  return (
    <div className="r-margin">
      <header className="r-margin__head">
        <div className="r-margin__ident">
          <h1 className="r-margin__name">{h.name}</h1>
          {h.headline && <p className="r-margin__headline">{h.headline}</p>}
        </div>
        <ContactBits doc={doc} />
      </header>

      {visibleSections(doc).map((s) => (
        <section key={s.id} className="r-margin__sec">
          <h2 className="r-margin__h">
            <span className="r-margin__h-label">{s.title}</span>
          </h2>
          {s.text && (
            <article className="r-margin__row r-margin__row--text">
              <span />
              <SectionText section={s} className="r-margin__text" />
            </article>
          )}
          {INLINE_TYPES.has(s.type) && s.items.length > 0 ? (
            <article className="r-margin__row">
              <span />
              <p className="r-margin__inline">
                {s.items.map((it, i) => (
                  <span key={it.id}>
                    {i > 0 && <span className="r-margin__sep"> · </span>}
                    {it.link ? <ItemLink link={{ ...it.link, label: it.title }} className="r-margin__inline-a" /> : it.title}
                  </span>
                ))}
              </p>
            </article>
          ) : (
            s.items.map((it) => (
              <article key={it.id} className="r-margin__row">
                <DateRange item={it} className="r-margin__date" />
                <div className="r-margin__body">
                  <p className="r-margin__title">
                    <strong>{it.title}</strong>
                    {it.subtitle && <span className="r-margin__org"> · {it.subtitle}</span>}
                    {it.location && <span className="r-margin__loc">, {it.location}</span>}
                  </p>
                  <Bullets bullets={it.bullets} className="r-margin__bullets" />
                  <ItemLink link={it.link} className="r-margin__link" />
                </div>
              </article>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
