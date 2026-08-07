import { redirect } from "next/navigation";
import { googleSignInAction, xSignInAction } from "@/lib/actions";
import { auth, isXAuthEnabled } from "@/auth";
import { Mark } from "@/components/Mark";

// Login screen (design: Logr Onboarding v2.dc.html) — centered card with the
// split top strip, blinking-cursor tagline, and mono sign-in buttons.

export const metadata = { title: "sign in", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // internal paths only (e.g. back to /oauth/authorize after sign-in)
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  if ((await auth())?.user) redirect(safeNext ?? "/dashboard"); // already signed in

  return (
    <div className="onb" style={{ minHeight: "100dvh", height: "auto" }}>
      <main className="onb2-main">
        <div className="onb2-login-frame">
          <div className="onb2-card">
            <div className="onb2-login-strip" />
            <div className="onb2-login-body">
              <div className="onb2-login-head">
                <span className="onb2-login-brand"><Mark />logr</span>
                <span className="onb2-login-beta">beta</span>
              </div>
              <p className="onb2-login-tag">
                one timeline, kept once<span className="onb2-login-caret" aria-hidden="true" />
              </p>
              <p className="onb2-login-sub">sign in to build and edit your logr.</p>
              <div className="onb2-login-btns">
                <form action={googleSignInAction}>
                  {safeNext && <input type="hidden" name="next" value={safeNext} />}
                  <button type="submit" className="onb2-login-btn">continue with Google →</button>
                </form>
                {isXAuthEnabled() && (
                  <form action={xSignInAction}>
                    {safeNext && <input type="hidden" name="next" value={safeNext} />}
                    <button type="submit" className="onb2-login-btn onb2-login-btn--ghost">continue with 𝕏 →</button>
                  </form>
                )}
              </div>
              {error && <p className="onb2-login-err">sign-in didn&apos;t complete — try again.</p>}
            </div>
            <div className="onb2-login-foot">
              <span>read by humans</span>
              <span>ingested by machines</span>
            </div>
          </div>
          <p className="onb2-login-note">no password. no feed. just your log.</p>
        </div>
      </main>
    </div>
  );
}
