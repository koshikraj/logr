"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Dashboard modal shell: scrim, Escape-to-close, body scroll lock.
 *
 *  variant "card" — the narrow prose card (delete confirm, simple dialogs);
 *  variant "wide" — the emodal split shell (event editor, add-events flow).
 *  On phones (≤600px) both present as a bottom sheet sliding up from the
 *  bottom edge (see the `.modal` rules in dashboard.css).
 *
 *  Renders in place (no portal) so the `.dash` scope and theme vars apply. */
export function Dialog({
  onClose,
  variant = "card",
  label,
  className,
  children,
}: {
  onClose: () => void;
  variant?: "card" | "wide";
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
      <div className="modal__overlay" onClick={onClose} />
      <div className={cn(variant === "wide" ? "emodal" : "modal__card", className)}>{children}</div>
    </div>
  );
}
