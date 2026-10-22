// founder — what you built comes first. A big headline, the summary as a
// traction line, projects laid out as a card grid, then everything else as
// a tight year-stamped list.

import { formatResumeYear } from "@/lib/resume-format";
import { ResumeIcon } from "../ResumeIcon";
import { Avatar, Bullets, ContactBits, DateRange, ItemLink, SectionHeading, SectionText, partitionSections, type TemplateProps } from "./shared";

export function FounderTemplate({ doc }: TemplateProps) {
  const h = doc.header;
  const { lead, rest } = partitionSections(doc, ["projects"]);
  const summary = rest.find((s) => s.type === "summary");
  const others = rest.filter((s) => s.type !== "summary");

  return (
    <div className="r-founder">
      <header className="r-founder__head">
        <div className="r-founder__ident">
          <h1 className="r-founder__name">{h.name}</h1>
          {h.headline && <p className="r-founder__headline">{h.headline}</p>}
          {summary && <SectionText section={summary} className="r-founder__traction" />}
          <ContactBits doc={doc} icons />
        </div>
        <Avatar doc={doc} className="r-founder__avatar" />
      </header>

      {lead.map((s) => (
        <section key={s.id} className="r-founder__sec">
          <SectionHeading section={s} className="r-founder__h" />
          <SectionText section={s} />
          <div className="r-founder__grid">
            {s.items.map((it) => (
              <article key={it.id} className="r-founder__card">
                <div className="r-founder__card-top">
                  <span className="r-founder__card-ico">
                    <ResumeIcon icon={it.icon} size={15} />
                  </span>
                  <span className="r-founder__year">{formatResumeYear(it.dateFrom)}{it.dateTo ? `–${formatResumeYear(it.dateTo)}` : ""}</span>
                </div>
                <h3 className="r-founder__card-title">{it.title}</h3>
                {it.subtitle && <p className="r-founder__card-sub">{it.subtitle}</p>}
                <Bullets bullets={it.bullets} className="r-founder__card-bullets" />
                <ItemLink link={it.link} className="r-founder__card-link" />
              </article>
            ))}
          </div>
        </section>
      ))}

      {others.map((s) => (
        <section key={s.id} className="r-founder__sec">
          <SectionHeading section={s} className="r-founder__h" />
          <SectionText section={s} />
          <div className="r-founder__list">
            {s.items.map((it) => (
              <article key={it.id} className="r-founder__row">
                <DateRange item={it} className="r-founder__row-date" />
                <div className="r-founder__row-body">
                  <h3 className="r-founder__row-title">
                    {it.title}
                    {it.subtitle && <span className="r-founder__row-sub"> · {it.subtitle}</span>}
                  </h3>
                  <Bullets bullets={it.bullets} />
                  <ItemLink link={it.link} className="r-founder__card-link" />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
