import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { auth, isXAuthEnabled } from "@/auth";
import { prisma } from "@/lib/db";
import { currentProfileId } from "@/lib/session";
import { findClaimable } from "@/lib/claim";
import { claimProfileAction } from "@/lib/actions";
import { DEFAULT_THEME, themeCssVars } from "@/lib/theme";
import { Mark } from "@/components/Mark";
import { ClaimButton } from "@/components/ClaimButton";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { isBrightDataEnabled } from "@/lib/import-sources";

export const metadata = { title: "welcome", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string; fresh?: string; claim?: string; x?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (await currentProfileId()) redirect("/dashboard"); // already onboarded

  const { handle, fresh, claim, x } = await searchParams;

  // A verified X handle matching a seeded profile → offer the claim first.
  const claimable = fresh ? null : await findClaimable(session.user.id);
  if (claimable) {
    const vars = themeCssVars(DEFAULT_THEME) as CSSProperties;
    return (
      <div className="dash" style={{ ...vars, display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ width: "100%", maxWidth: 440, marginBottom: 0 }}>
          <div className="card__head" style={{ marginBottom: 20 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 24, letterSpacing: "-0.03em", color: "var(--ink)" }}>
              <Mark />logr
            </span>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
            {claimable.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={claimable.avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--rule)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--serif)", fontSize: 24 }}>
                {claimable.name.trim()[0]?.toLowerCase() ?? "·"}
              </span>
            )}
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19, color: "var(--ink)" }}>{claimable.name}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                logr.it/{claimable.username} · {claimable.eventCount} events
              </div>
            </div>
          </div>

          <p className="modal__sub" style={{ marginBottom: 8 }}>{claimable.bio}</p>
          <p className="modal__sub" style={{ marginBottom: 20 }}>
            we prepared this profile from public sources. you&apos;re verified as{" "}
            <strong>𝕏 @{claimable.xHandle}</strong> — so it&apos;s yours to claim: the unverified banner
            comes off, and every entry becomes editable.
          </p>

          {claim === "failed" && (
            <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#b3402a", marginBottom: 12 }}>
              that claim didn&apos;t go through — try again.
            </p>
          )}
          <form action={claimProfileAction}>
            <ClaimButton username={claimable.username} />
          </form>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <a href="/welcome?fresh=1" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
              not you, or want a fresh start? →
            </a>
          </p>
        </div>
      </div>
    );
  }

  const hinted = (handle ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  const suggested =
    hinted ||
    (session.user.name ?? session.user.email ?? "")
      .toLowerCase()
      .replace(/@.*$/, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 24);

  // Google users may still have a seeded profile waiting — offer the X check
  // once, unobtrusively, when they haven't linked X and nothing matched.
  const showXHint =
    isXAuthEnabled() &&
    !fresh &&
    !(await prisma.account.findFirst({ where: { userId: session.user.id, provider: "twitter" }, select: { id: true } }));

  return (
    <>
      <Onboarding
        name={session.user.name ?? ""}
        image={session.user.image ?? ""}
        suggestedHandle={suggested}
        scraperEnabled={isBrightDataEnabled()}
      />
      {(claim === "failed" || x === "error" || showXHint) && (
        <div data-welcome-hint style={{ position: "fixed", bottom: 12, left: 0, right: 0, textAlign: "center", zIndex: 50, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
          {claim === "failed" && <span style={{ color: "#b3402a" }}>couldn&apos;t claim that profile — it may have just been claimed. </span>}
          {x === "error" && <span style={{ color: "#b3402a" }}>𝕏 verification didn&apos;t complete — try again. </span>}
          {showXHint && (
            <a href="/api/x/connect?return=welcome" style={{ color: "inherit", opacity: 0.7 }}>
              made a name on 𝕏? check for your ready-made profile →
            </a>
          )}
        </div>
      )}
    </>
  );
}
