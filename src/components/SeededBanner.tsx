"use client";

import { useEffect, useState } from "react";

// Disclosure banner + claim dialog for published-but-unclaimed seeded
// profiles. Claiming = sign in with the attributed account; the welcome
// screen then recognizes the verified handle and offers the profile.

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.66.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

// Claim providers: X live; GitHub / LinkedIn built but hidden until their
// verify flows exist — flip `enabled` to surface them.
const CLAIM_OPTIONS = [
  {
    key: "x",
    enabled: true,
    icon: <XIcon />,
    label: "Claim with X",
    desc: "sign in with the attributed X account",
    href: "/login",
  },
  {
    key: "github",
    enabled: false,
    icon: <GitHubIcon />,
    label: "Claim with GitHub",
    desc: "coming soon",
    href: "#",
  },
  {
    key: "linkedin",
    enabled: false,
    icon: <LinkedInIcon />,
    label: "Claim with LinkedIn",
    desc: "coming soon",
    href: "#",
  },
];

export function SeededBanner({ name, handle, contact }: { name?: string; handle: string; contact: string }) {
  const [open, setOpen] = useState(false);
  const removal = `mailto:${contact}?subject=${encodeURIComponent(`Remove logr.life/${handle}`)}`;
  const first = name ? name.split(" ")[0] : "you";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="seeded-banner" role="note">
        <span className="seeded-banner__badge">unverified</span>
        <span className="seeded-banner__text">
          auto-generated from public sources — every entry links its source (↗).{" "}
          <strong>is this {first}?</strong>
        </span>
        <button type="button" className="seeded-banner__cta" onClick={() => setOpen(true)}>
          claim now →
        </button>
        <a className="seeded-banner__removal" href={removal}>request removal</a>
      </div>

      {open && (
        <div className="claim-modal" role="dialog" aria-modal="true" aria-label="claim this profile">
          <div className="claim-modal__scrim" onClick={() => setOpen(false)} />
          <div className="claim-modal__card">
            <button type="button" className="claim-modal__close" onClick={() => setOpen(false)} aria-label="close">×</button>
            <h2 className="claim-modal__title">claim this profile<span className="claim-modal__colon">.</span></h2>
            <p className="claim-modal__sub">
              this page was prepared from public sources. verify one of the accounts it&apos;s
              attributed to, and it becomes yours — editable, with the unverified banner gone.
            </p>
            <div className="claim-modal__options">
              {CLAIM_OPTIONS.filter((o) => o.enabled).map((o) => (
                <a key={o.key} className="claim-option" href={o.href}>
                  <span className="claim-option__icon">{o.icon}</span>
                  <span className="claim-option__copy">
                    <span className="claim-option__label">{o.label}</span>
                    <span className="claim-option__desc">{o.desc}</span>
                  </span>
                  <span className="claim-option__arrow" aria-hidden="true">→</span>
                </a>
              ))}
            </div>
            <p className="claim-modal__foot">
              not {first}? <a href={removal}>request removal</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
