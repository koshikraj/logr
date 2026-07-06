import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { isXConnectEnabled, newOAuthState, authorizeUrl, X_COOKIE } from "@/lib/xoauth";

export const dynamic = "force-dynamic";

// Start the connect-X dance for the signed-in user. State + PKCE verifier
// travel in a short-lived httpOnly cookie; X sends the user back to
// /api/x/callback, which writes the Account row.
export async function GET(req: NextRequest) {
  if (!isXConnectEnabled()) return NextResponse.redirect(new URL("/dashboard?x=disabled", req.nextUrl.origin));
  if (!(await getUserId())) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const { state, verifier, challenge } = newOAuthState();
  // where to land after the dance — whitelisted, defaults to the dashboard
  const ret = req.nextUrl.searchParams.get("return") === "welcome" ? "/welcome" : "/dashboard";
  const res = NextResponse.redirect(authorizeUrl(req.nextUrl.origin, state, challenge));
  res.cookies.set(X_COOKIE, JSON.stringify({ state, verifier, ret }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the top-level redirect back from x.com
    maxAge: 600,
    path: "/api/x",
  });
  return res;
}
