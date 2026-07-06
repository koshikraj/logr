import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { exchangeAndFetchUser, X_COOKIE } from "@/lib/xoauth";

export const dynamic = "force-dynamic";

// Completes the connect-X dance: validates state, exchanges the code, reads
// the authenticated X identity, and writes the Account row onto the CURRENT
// session's User — the manual version of what the Auth.js adapter does on
// sign-in, which is exactly what lets us link without an email match and
// without Auth.js switching the session to a new User. After this row exists,
// "login with X" works through the stock Twitter provider.
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(X_COOKIE)?.value;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  let saved: { state?: string; verifier?: string; ret?: string } = {};
  try {
    saved = JSON.parse(cookie ?? "{}");
  } catch {
    /* treated as missing below */
  }
  const ret = saved.ret === "/welcome" ? "/welcome" : "/dashboard";
  const back = (q: string) => NextResponse.redirect(new URL(`${ret}?x=${q}`, req.nextUrl.origin));

  const userId = await getUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const done = (q: string) => {
    const res = back(q);
    res.cookies.delete(X_COOKIE);
    return res;
  };

  if (!code || !state || !saved.state || !saved.verifier) return done("error");
  if (state !== saved.state) return done("error"); // CSRF / mixed-up dance

  let x: { id: string; username: string };
  try {
    x = await exchangeAndFetchUser(req.nextUrl.origin, code, saved.verifier);
  } catch (e) {
    console.error("x connect failed:", e instanceof Error ? e.message : e);
    return done("error");
  }

  // One X account belongs to at most one logr user.
  const existing = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "twitter", providerAccountId: x.id } },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) return done("taken");
  if (!existing) {
    await prisma.account.create({
      data: { userId, type: "oauth", provider: "twitter", providerAccountId: x.id, username: x.username },
    });
  } else {
    // refresh the stored handle — people rename on X
    await prisma.account.updateMany({
      where: { provider: "twitter", providerAccountId: x.id },
      data: { username: x.username },
    });
  }

  return done(`connected&handle=${encodeURIComponent(x.username)}`);
}
