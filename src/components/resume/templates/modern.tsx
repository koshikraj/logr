// modern — two columns with the accent colour doing the work: a wide main
// column for the story (summary, experience, projects…) and a narrow
// sidebar for contact, links, skills and the short lists.

import { sectionPlacement, type ResumeSection } from "@/lib/resume";
import { linkDisplay, visibleSections } from "@/lib/resume-format";
import { ResumeIcon } from "../ResumeIcon";
import { Avatar, Bullets, DateRange, ItemLink, SectionHeading, SectionText, type TemplateProps } from "./shared";

function MainSection({ s }: { s: ResumeSection }) {
  return (
    <section className="r-modern__sec">
      <SectionHeading section={s} />
      <SectionText section={s} />
      <div className="r-modern__items">
        {s.items.map((it) => (
          <article key={it.id} className="r-modern__item">
            <span className="r-modern__dot" aria-hidden="true">
              <ResumeIcon icon={it.icon} size={11} />
            </span>
            <div className="r-modern__body">
              <div className="r-modern__row">
                <h3 className="r-modern__title">{it.title}</h3>
                <DateRange item={it} className="r-modern__date" />
              </div>
              {(it.subtitle || it.location) && (
                <p className="r-modern__sub">
                  {it.subtitle}
                  {it.subtitle && it.location ? " — " : ""}
                  {it.location}
                </p>
              )}
              <Bullets bullets={it.bullets} />
              <ItemLink link={it.link} className="r-modern__link" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SideSection({ s }: { s: ResumeSection }) {
  return (
    <section className="r-modern__side-sec">
      <SectionHeading section={s} as="h3" className="r-modern__side-h" />
      <SectionText section={s} className="r-modern__side-text" />
      <ul className="r-modern__side-list">
        {s.items.map((it) => (
          <li key={it.id}>
            <span className="r-modern__side-title">
              {it.link ? <ItemLink link={{ ...it.link, label: it.title }} className="r-modern__side-a" /> : it.title}
            </span>
            {(it.subtitle || it.dateFrom) && (
              <span className="r-modern__side-meta">
                {it.subtitle}
                {it.subtitle && it.dateFrom ? " · " : ""}
                <DateRange item={it} className="" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ModernTemplate({ doc }: TemplateProps) {
  const h = doc.header;
  const all = visibleSections(doc);
  // owner placement first, then the defaults (skills + links in the sidebar)
  const main = all.filter((s) => sectionPlacement(s) === "main");
  const side = all.filter((s) => sectionPlacement(s) === "side");
  const contact = [
    h.location ? { icon: "lucide:map-pin", label: h.location, href: null } : null,
    h.email ? { icon: "lucide:mail", label: h.email, href: `mailto:${h.email}` } : null,
    ...h.links.map((l) => ({ icon: l.icon ?? "lucide:link", label: l.label || linkDisplay(l.href), href: l.href })),
  ].filter((x): x is { icon: string; label: string; href: string | null } => !!x);

  return (
    <div className="r-modern" data-sidebar={doc.sidebar ?? "left"}>
      <aside className="r-modern__side" data-flow="side">
        <Avatar doc={doc} className="r-modern__avatar" />
        <div className="r-modern__ident">
          <h1 className="r-modern__name">{h.name}</h1>
          {h.headline && <p className="r-modern__headline">{h.headline}</p>}
        </div>
        {contact.length > 0 && (
          <ul className="r-modern__contact">
            {contact.map((c, i) => (
              <li key={i}>
                <ResumeIcon icon={c.icon} size={12} className="r-modern__contact-ico" />
                {c.href ? (
                  <a href={c.href} target={c.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
                    {c.label}
                  </a>
                ) : (
                  <span>{c.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {side.map((s) => (
          <SideSection key={s.id} s={s} />
        ))}
      </aside>
      <main className="r-modern__main" data-flow="main">
        {main.map((s) => (
          <MainSection key={s.id} s={s} />
        ))}
      </main>
    </div>
  );
}
