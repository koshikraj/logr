import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/** True when Google sign-in is configured (lets us keep it behind a flag). */
export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

/** True when X sign-in is configured. */
export function isXAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET);
}

// Google + X sign-in via Auth.js, with the Prisma adapter (database sessions).
// Reads AUTH_GOOGLE_ID/SECRET, AUTH_TWITTER_ID/SECRET, AUTH_SECRET from env.
//
// X sign-in works two ways:
//  - cold signup/login: an unknown X identity creates a fresh User (email may
//    be null — X often doesn't return one). The welcome flow then offers any
//    claimable seeded profile whose attributedX matches their handle.
//  - connected login: a user who linked X from the dashboard
//    (/api/x/connect) signs in to their existing account — the adapter
//    resolves provider+providerAccountId → User, no email needed.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(isGoogleAuthEnabled() ? [Google] : []),
    ...(isXAuthEnabled() ? [Twitter] : []),
  ],
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user }) {
      if (session.user && user) session.user.id = user.id;
      return session;
    },
    async signIn({ profile, user }) {
      // Block Auth.js's automatic account-linking for every email-bearing
      // provider: if the incoming account's email differs from the email
      // already on the User record, deny the link. Without this, signing in
      // with a second account while a session is active silently merges both
      // accounts into one User.
      if (user?.email && profile?.email && user.email !== profile.email) {
        return false;
      }
      return true;
    },
  },
});
