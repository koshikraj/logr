// Disclosure banner for published-but-unclaimed seeded profiles
// (PLAN-seeded-profiles.md, Phase 3). Rendered inside the themed `.logr` root.
// Claim + removal are mailto for now — the OAuth claim flow is Phase 4.
export function SeededBanner({ handle, contact }: { name?: string; handle: string; contact: string }) {
  // claim = sign in with the attributed X account → the welcome screen offers
  // this profile automatically (verified-handle match).
  const claim = "/login";
  const removal = `mailto:${contact}?subject=${encodeURIComponent(`Remove logr.life/${handle}`)}`;
  return (
    <div className="seeded-banner" role="note">
      <span className="seeded-banner__text">
        auto-generated from public sources — unverified. each entry links its source (↗).
      </span>
      <span className="seeded-banner__actions">
        <a href={claim}>is this you? sign in with 𝕏 to claim it</a>
        <span aria-hidden="true">·</span>
        <a href={removal}>request removal</a>
      </span>
    </div>
  );
}
