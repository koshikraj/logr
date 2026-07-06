// Disclosure banner for published-but-unclaimed seeded profiles
// (PLAN-seeded-profiles.md, Phase 3). Rendered inside the themed `.logr` root.
// Claim + removal are mailto for now — the OAuth claim flow is Phase 4.
export function SeededBanner({ name, handle, contact }: { name: string; handle: string; contact: string }) {
  const claim = `mailto:${contact}?subject=${encodeURIComponent(`Claiming logr.life/${handle}`)}&body=${encodeURIComponent(
    `Hi — I'm ${name} and I'd like to claim this profile. My X/GitHub handle: `
  )}`;
  const removal = `mailto:${contact}?subject=${encodeURIComponent(`Remove logr.life/${handle}`)}`;
  return (
    <div className="seeded-banner" role="note">
      <span className="seeded-banner__text">
        auto-generated from public sources — unverified. each entry links its source (↗).
      </span>
      <span className="seeded-banner__actions">
        <a href={claim}>is this you? claim your profile</a>
        <span aria-hidden="true">·</span>
        <a href={removal}>request removal</a>
      </span>
    </div>
  );
}
