import "server-only";
import { prisma } from "@/lib/db";

// Seeded-profile claim (PLAN Phase 4, "use 3"). A signed-in user whose
// VERIFIED X handle matches a published seeded profile's attributedX can
// claim it from the welcome screen. Verification comes from one of two
// places, both of which prove control of the X account:
//   - the connect flow (/api/x/callback) stored Account.username, or
//   - they signed up via X and we resolve the handle lazily from the
//     access token Auth.js stored at signup (see ensureXUsername).
//
// Scope note: claiming is only offered to users WITHOUT a profile (the
// welcome screen is exactly that state). Merge-on-claim for users who
// already own a profile is deliberately not built yet.

/** The user's verified X handle, resolving + persisting it lazily when the
 *  Account row predates the username column or came from a cold X signup. */
export async function ensureXUsername(userId: string): Promise<string | null> {
  try {
    const acct = await prisma.account.findFirst({
      where: { userId, provider: "twitter" },
      select: { id: true, username: true, access_token: true },
    });
    if (!acct) return null;
    if (acct.username) return acct.username;
    if (!acct.access_token) return null; // connect-flow rows always have username; nothing to resolve with

    // Cold X signup: Auth.js stored the OAuth tokens — one users/me call
    // resolves the handle. Token lives ~2h; signup → welcome is seconds.
    const res = await fetch("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${acct.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data?: { username?: string } };
    if (!data?.username) return null;
    await prisma.account.update({ where: { id: acct.id }, data: { username: data.username } });
    return data.username;
  } catch {
    // e.g. the username column's migration isn't applied yet — degrade to "no claim offer"
    return null;
  }
}

export type Claimable = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  eventCount: number;
  xHandle: string;
};

/** The published seeded profile this user's verified X handle entitles them
 *  to — or null (no X link, no match, or they already have a profile). */
export async function findClaimable(userId: string): Promise<Claimable | null> {
  const hasProfile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (hasProfile) return null;

  const xHandle = await ensureXUsername(userId);
  if (!xHandle) return null;

  const profile = await prisma.profile.findFirst({
    where: {
      claimStatus: "published",
      userId: null,
      attributedX: { equals: xHandle, mode: "insensitive" },
    },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
      bio: true,
      _count: { select: { events: true } },
    },
  });
  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    eventCount: profile._count.events,
    xHandle,
  };
}

/** Execute the claim: re-verify entitlement, then flip ownership atomically. */
export async function claimProfile(userId: string): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const claimable = await findClaimable(userId); // re-check — never trust the earlier render
  if (!claimable) return { ok: false, error: "Nothing to claim for this account." };

  // updateMany + status/userId guards: a concurrent claim of the same profile
  // (or a second profile for this user) loses the race harmlessly.
  const res = await prisma.profile.updateMany({
    where: { id: claimable.id, claimStatus: "published", userId: null },
    data: { userId, claimStatus: "claimed", claimProofToken: null },
  });
  if (res.count === 0) return { ok: false, error: "This profile was just claimed — contact us if that wasn't you." };

  return { ok: true, username: claimable.username };
}
