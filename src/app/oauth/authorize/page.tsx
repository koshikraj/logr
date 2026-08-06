import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { currentProfileId } from "@/lib/session";
import { validateAuthorizeRequest } from "@/lib/oauth";
import { approveOAuthAction, denyOAuthAction } from "@/lib/actions";
import { Mark } from "@/components/Mark";

// OAuth 2.1 consent screen (issue #58 phase 2): an MCP client lands here from
// its authorize redirect; the signed-in owner grants it scoped write access
// to their own profile. All parameters are re-validated in the approve action
// — the hidden fields are a convenience, not a trust boundary.

export const metadata = { title: "authorize", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  "events:write": "add, edit, and delete timeline events",
  "profile:write": "update your bio, status, location, and about",
};

const PARAM_KEYS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="onb" style={{ minHeight: "100dvh", height: "auto" }}>
      <main className="onb2-main">
        <div className="onb2-login-frame">
          <div className="onb2-card">
            <div className="onb2-login-strip" />
            <div className="onb2-login-body">
              <div className="onb2-login-head">
                <span className="onb2-login-brand"><Mark />logr</span>
              </div>
              <p className="onb2-login-tag">authorization request rejected</p>
              <p className="onb2-login-sub">{message}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: { [k: string]: string | undefined } = {};
  for (const key of PARAM_KEYS) {
    const v = raw[key];
    params[key] = Array.isArray(v) ? v[0] : v;
  }

  const result = await validateAuthorizeRequest(params);
  if (!result.ok && result.kind === "fatal") return <ErrorCard message={result.error} />;
  if (!result.ok) {
    const url = new URL(result.redirectUri);
    url.searchParams.set("error", result.error);
    if (result.state) url.searchParams.set("state", result.state);
    redirect(url.toString());
  }

  if (!(await auth())?.user) {
    const qs = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)
    );
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs.toString()}`)}`);
  }
  const profileId = await currentProfileId();
  if (!profileId) redirect("/welcome"); // signed in but not onboarded yet
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { username: true, name: true },
  });
  if (!profile) redirect("/welcome");

  const { request } = result;
  const hidden = PARAM_KEYS.filter((k) => params[k] !== undefined).map((k) => (
    <input key={k} type="hidden" name={k} value={params[k]} />
  ));

  return (
    <div className="onb" style={{ minHeight: "100dvh", height: "auto" }}>
      <main className="onb2-main">
        <div className="onb2-login-frame">
          <div className="onb2-card">
            <div className="onb2-login-strip" />
            <div className="onb2-login-body">
              <div className="onb2-login-head">
                <span className="onb2-login-brand"><Mark />logr</span>
              </div>
              <p className="onb2-login-tag">
                <strong>{request.clientName}</strong> wants access to{" "}
                <strong>@{profile.username}</strong>
              </p>
              <p className="onb2-login-sub">this agent will be able to:</p>
              <ul className="onb2-login-sub" style={{ paddingLeft: "1.2em", margin: "0 0 12px" }}>
                {request.scopes.map((s) => (
                  <li key={s}>{SCOPE_LABELS[s] ?? s}</li>
                ))}
                <li>read your public log (like anyone else)</li>
              </ul>
              <div className="onb2-login-btns">
                <form action={approveOAuthAction}>
                  {hidden}
                  <button type="submit" className="onb2-login-btn">authorize →</button>
                </form>
                <form action={denyOAuthAction}>
                  {hidden}
                  <button type="submit" className="onb2-login-btn onb2-login-btn--ghost">deny</button>
                </form>
              </div>
            </div>
            <div className="onb2-login-foot">
              <span>revoke anytime</span>
              <span>dashboard → agents</span>
            </div>
          </div>
          <p className="onb2-login-note">
            grants are scoped to your profile and can be revoked from the dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}
