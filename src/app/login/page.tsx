import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { googleSignInAction, xSignInAction } from "@/lib/actions";
import { auth, isXAuthEnabled } from "@/auth";
import { DEFAULT_THEME, themeCssVars } from "@/lib/theme";
import { Mark } from "@/components/Mark";

export const metadata = { title: "sign in — logr" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if ((await auth())?.user) redirect("/dashboard"); // already signed in
  const { error } = await searchParams;
  const vars = themeCssVars(DEFAULT_THEME) as CSSProperties;

  return (
    <div className="dash" style={{ ...vars, display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 380, marginBottom: 0 }}>
        <div className="card__head" style={{ marginBottom: 24 }}>
          <span className="login-brand" style={{ fontFamily: "var(--serif)", fontSize: 24, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            <Mark />logr
          </span>
        </div>
        <p className="modal__sub" style={{ marginBottom: 24 }}>sign in to build and edit your logr.</p>
        <form action={googleSignInAction}>
          <button type="submit" className="btn btn--primary" style={{ width: "100%", justifyContent: "center" }}>continue with Google →</button>
        </form>
        {isXAuthEnabled() && (
          <form action={xSignInAction} style={{ marginTop: 10 }}>
            <button type="submit" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>continue with 𝕏 →</button>
          </form>
        )}
        {error === "x-not-connected" && (
          <p className="modal__sub" style={{ marginTop: 16, color: "var(--user-accent)" }}>
            that 𝕏 account isn&apos;t linked to a logr yet — sign in with Google first, then connect 𝕏 from your dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
