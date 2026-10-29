import { iconKind, LUCIDE_PREFIX } from "@/lib/resume-format";
import { LUCIDE_ICONS } from "./icons";

/** Renders a resume icon: emoji glyph, uploaded image, or `lucide:<name>`.
 *  Returns null for unknown / empty icons so layouts can collapse the slot. */
export function ResumeIcon({ icon, size = 14, className }: { icon: string | null | undefined; size?: number; className?: string }) {
  const kind = iconKind(icon);
  if (kind === "none") return null;
  if (kind === "lucide") {
    const Icon = LUCIDE_ICONS[icon!.slice(LUCIDE_PREFIX.length)];
    return Icon ? <Icon size={size} strokeWidth={1.6} className={className} aria-hidden="true" /> : null;
  }
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon!} alt="" width={size} height={size} className={className} style={{ width: size, height: size, objectFit: "cover" }} />;
  }
  return (
    <span className={className} aria-hidden="true" style={{ fontSize: size * 0.95, lineHeight: 1 }}>
      {icon}
    </span>
  );
}
