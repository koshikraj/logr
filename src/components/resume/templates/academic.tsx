// academic — dense and numbered. Talks and writing lead (a CV is read for
// output), every entry is numbered within its section, years sit in a
// narrow left column, and type is small with tight leading.

import { formatResumeYear } from "@/lib/resume-format";
import { Bullets, ContactBits, ItemLink, SectionText, partitionSections, type TemplateProps } from "./shared";

export function AcademicTemplate({ doc }: TemplateProps) {
  const h = doc.header;
  const { lead, rest } = partitionSections(doc, ["writing", "talks"]);
  const summary = rest.find((s) => s.type === "summary");
  const ordered = [...(summary ? [summary] : []), ...lead, ...rest.filter((s) => s.type !== "summary")];

  return (
    <div className="r-academic">
      <header className="r-academic__head">
        <h1 className="r-academic__name">{h.name}</h1>
        {h.headline && <p className="r-academic__headline">{h.headline}</p>}
        <ContactBits doc={doc} />
      </header>

      {ordered.map((s) => (
        <section key={s.id} className="r-academic__sec">
          <h2 className="r-academic__h">
            <span>{s.title}</span>
            {s.items.length > 0 && <span className="r-academic__count">{s.items.length}</span>}
          </h2>
          <SectionText section={s} className="r-academic__text" />
          {s.items.length > 0 && (
            <ol className="r-academic__list">
              {s.items.map((it, i) => (
                <li key={it.id} className="r-academic__entry">
                  <span className="r-academic__num">{i + 1}.</span>
                  <span className="r-academic__year">
                    {formatResumeYear(it.dateFrom)}
                    {it.dateTo ? `–${formatResumeYear(it.dateTo)}` : ""}
                  </span>
                  <span className="r-academic__body">
                    <span className="r-academic__title">{it.title}</span>
                    {it.subtitle && <span className="r-academic__venue">. {it.subtitle}</span>}
                    {it.location && <span className="r-academic__venue">, {it.location}</span>}
                    {it.link && (
                      <>
                        {" "}
                        <ItemLink link={it.link} className="r-academic__link" />
                      </>
                    )}
                    <Bullets bullets={it.bullets} className="r-academic__bullets" />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
