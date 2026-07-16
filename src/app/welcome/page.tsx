import { redirect } from "next/navigation";
import { auth, isXAuthEnabled } from "@/auth";
import { prisma } from "@/lib/db";
import { currentProfileId } from "@/lib/session";
import { findClaimable } from "@/lib/claim";
import { claimProfileAction } from "@/lib/actions";
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
    return (
      <div className="onb" style={{ minHeight: "100dvh", height: "auto" }}>
        <main className="onb2-main">
          <div className="onb2-login-frame">
            <div className="onb2-card">
              <div className="onb2-login-strip" />
              <div className="onb2-login-body">
                <div className="onb2-login-head">
                  <span className="onb2-login-brand"><Mark />logr</span>
                  <span className="onb2-login-beta">claim</span>
                </div>

                <div className="onb2-you-row" style={{ marginBottom: 14 }}>
                  <span className="onb2-polaroid">
                    {claimable.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={claimable.avatarUrl} alt="" />
                    ) : (
                      <span className="onb2-polaroid__letter">{claimable.name.trim()[0]?.toLowerCase() ?? "·"}</span>
                    )}
                  </span>
                  <div className="onb2-name-col">
                    <span style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--ink)" }}>{claimable.name}</span>
                    <span className="onb2-hint">logr.it/{claimable.username} · {claimable.eventCount} events</span>
                  </div>
                </div>

                <p className="onb2-login-tag" style={{ fontSize: 14 }}>{claimable.bio}</p>
                <p className="onb2-login-sub" style={{ marginBottom: 22 }}>
                  we prepared this profile from public sources. you&apos;re verified as{" "}
                  <strong>𝕏 @{claimable.xHandle}</strong> — so it&apos;s yours to claim: the unverified banner
                  comes off, and every entry becomes editable.
                </p>

                {claim === "failed" && (
                  <p className="onb2-login-err" style={{ margin: "0 0 12px" }}>
                    that claim didn&apos;t go through — try again.
                  </p>
                )}
                <form action={claimProfileAction}>
                  <ClaimButton username={claimable.username} />
                </form>
              </div>
              <div className="onb2-login-foot">
                <span>read by humans</span>
                <span>ingested by machines</span>
              </div>
            </div>
            <p className="onb2-login-note">
              <a href="/welcome?fresh=1" style={{ color: "inherit" }}>not you, or want a fresh start? →</a>
            </p>
          </div>
        </main>
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
