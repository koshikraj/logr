import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isXAuthEnabled } from "@/auth";
import { currentProfileId, getUserId } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Dashboard — logr" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profileId = await currentProfileId();
  if (!profileId) {
    // signed in with Google but hasn't onboarded → /welcome; otherwise sign in
    redirect((await getUserId()) ? "/welcome" : "/login");
  }

  const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true } });
  const profile = row ? await getProfile(row.username) : null;
  if (!profile) redirect("/login");

  // connected-accounts state for the bar's "connect X" control
  const userId = await getUserId();
  const xConnected = isXAuthEnabled()
    ? Boolean(await prisma.account.findFirst({ where: { userId: userId!, provider: "twitter" }, select: { id: true } }))
    : null; // null = X auth not configured, hide the control

  // Events arrive sorted by position asc; expose a contiguous index.
  const events = profile.events.map((e, i) => ({
    id: e.id,
    dateOn: e.dateOn,
    date: e.date,
    fullDate: e.fullDate,
    title: e.title,
    tags: e.tags,
    featured: e.featured,
    body: e.body,
    icon: e.icon,
    linkLabel: e.link?.label ?? null,
    linkHref: e.link?.href ?? null,
    position: i,
    media: e.media,
  }));

  return <AdminShell profile={profile} events={events} xConnected={xConnected} />;
}
