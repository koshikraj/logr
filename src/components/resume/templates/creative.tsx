// creative — for work you can see. A bold accent band up top, the summary
// set large, and every item that has an image gets a thumbnail. Generous
// whitespace; headings are small caps so the work stays loud.

import { visibleSections } from "@/lib/resume-format";
import { ResumeIcon } from "../ResumeIcon";
import { Avatar, Bullets, ContactBits, DateRange, ItemLink, SectionHeading, SectionText, type TemplateProps } from "./shared";

export function CreativeTemplate({ doc }: TemplateProps) {
  const h = doc.header;
  const all = visibleSections(doc);
  const summary = all.find((s) => s.type === "summary");
  const sections = all.filter((s) => s.type !== "summary");

  return (
    <div className="r-creative">
      <header className="r-creative__band">
        <Avatar doc={doc} className="r-creative__avatar" />
        <div className="r-creative__ident">
          <h1 className="r-creative__name">{h.name}</h1>
          {h.headline && <p className="r-creative__headline">{h.headline}</p>}
        </div>
        <div className="r-creative__contact">
          <ContactBits doc={doc} icons />
        </div>
      </header>

      {summary && <SectionText section={summary} className="r-creative__summary" />}

      {sections.map((s) => (
        <section key={s.id} className="r-creative__sec">
          <SectionHeading section={s} className="r-creative__h" />
          <SectionText section={s} />
          <div className="r-creative__items">
            {s.items.map((it) => (
              <article key={it.id} className={`r-creative__item${it.image ? " r-creative__item--img" : ""}`}>
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="r-creative__thumb" src={it.image} alt="" />
                ) : (
                  <span className="r-creative__thumb r-creative__thumb--ico">
                    <ResumeIcon icon={it.icon} size={18} />
                  </span>
                )}
                <div className="r-creative__body">
                  <DateRange item={it} className="r-creative__date" />
                  <h3 className="r-creative__title">{it.title}</h3>
                  {(it.subtitle || it.location) && (
                    <p className="r-creative__sub">
                      {it.subtitle}
                      {it.subtitle && it.location ? " · " : ""}
                      {it.location}
                    </p>
                  )}
                  <Bullets bullets={it.bullets} />
                  <ItemLink link={it.link} className="r-creative__link" />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
