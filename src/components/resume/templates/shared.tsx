// Building blocks shared by the resume templates (#66). Every template
// renders the same ResumeDocument; these keep the data handling identical
// while each template owns its own structure and CSS.

import type { ResumeDocument, ResumeItem, ResumeSection, SectionType } from "@/lib/resume";
import { formatResumeRange, linkDisplay, visibleSections } from "@/lib/resume-format";
import { ResumeIcon } from "../ResumeIcon";

export type TemplateProps = { doc: ResumeDocument };

/** Sections split so a template can promote some types without losing the
 *  owner's order inside each group. */
export function partitionSections(doc: ResumeDocument, first: SectionType[]): { lead: ResumeSection[]; rest: ResumeSection[] } {
  const all = visibleSections(doc);
  const lead = all.filter((s) => first.includes(s.type));
  const rest = all.filter((s) => !first.includes(s.type));
  return { lead, rest };
}

export function Bullets({ bullets, className }: { bullets: string[]; className?: string }) {
  const list = bullets.map((b) => b.trim()).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul className={className ?? "r-bullets"}>
      {list.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export function ItemLink({ link, className }: { link: ResumeItem["link"]; className?: string }) {
  if (!link) return null;
  return (
    <a className={className ?? "r-link"} href={link.href} target="_blank" rel="noopener noreferrer">
      {link.label || linkDisplay(link.href)}
    </a>
  );
}

export function DateRange({ item, className }: { item: ResumeItem; className?: string }) {
  const range = formatResumeRange(item);
  if (!range) return null;
  return <span className={className ?? "r-date"}>{range}</span>;
}

/** Header contact line pieces: location · email · links. */
export function ContactBits({ doc, icons = false }: { doc: ResumeDocument; icons?: boolean }) {
  const h = doc.header;
  const bits: React.ReactNode[] = [];
  if (h.location) bits.push(<span key="loc" className="r-contact__bit">{icons && <ResumeIcon icon="lucide:map-pin" size={12} />}{h.location}</span>);
  if (h.email)
    bits.push(
      <a key="mail" className="r-contact__bit" href={`mailto:${h.email}`}>
        {icons && <ResumeIcon icon="lucide:mail" size={12} />}
        {h.email}
      </a>
    );
  for (const l of h.links) {
    bits.push(
      <a key={l.href} className="r-contact__bit" href={l.href} target="_blank" rel="noopener noreferrer">
        {icons && <ResumeIcon icon={l.icon ?? "lucide:link"} size={12} />}
        {l.label || linkDisplay(l.href)}
      </a>
    );
  }
  if (!bits.length) return null;
  return <p className="r-contact">{bits}</p>;
}

export function Avatar({ doc, className }: { doc: ResumeDocument; className?: string }) {
  const h = doc.header;
  if (!h.showAvatar || !h.avatarUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className ?? "r-avatar"} src={h.avatarUrl} alt="" />;
}

export function SectionHeading({ section, icon = true, as: Tag = "h2", className }: { section: ResumeSection; icon?: boolean; as?: "h2" | "h3"; className?: string }) {
  return (
    <Tag className={className ? `r-h ${className}` : "r-h"}>
      {icon && section.icon && <ResumeIcon icon={section.icon} size={14} className="r-h__ico" />}
      <span>{section.title}</span>
    </Tag>
  );
}

/** Text-only sections (summary, custom with text) render a paragraph. */
export function SectionText({ section, className }: { section: ResumeSection; className?: string }) {
  const text = (section.text ?? "").trim();
  if (!text) return null;
  return <p className={className ?? "r-text"}>{text}</p>;
}
