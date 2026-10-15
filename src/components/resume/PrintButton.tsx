"use client";

import { useEffect } from "react";

/** "Download PDF" = the browser's print-to-PDF. The print stylesheet hides
 *  everything but the sheet and sizes the page, so the text stays selectable. */
export function PrintButton({ className = "btn-print btn-print--primary", label = "download pdf" }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <path d="M8 2.5v8M8 10.5L5 7.5M8 10.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 11v2.5h10V11" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}

/** Opens the print dialog as soon as the page is painted (owner print route). */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
