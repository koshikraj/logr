import Portfolio from "@/components/Portfolio";
import { isChatEnabled } from "@/lib/chat";
import { auth } from "@/auth";
import type { ProfileDTO } from "@/lib/profile";

/** Server wrapper for the public timeline. The client component owns the
 *  themed `.logr` root (palette CSS vars + data-layout), so SSR is themed
 *  with no flash. Shared by the homepage and /[username]. */
export async function PortfolioPage({ profile }: { profile: ProfileDTO }) {
  const chatEnabled = isChatEnabled() || process.env.NODE_ENV !== "production";
  const session = await auth();
  const loggedIn = !!session?.user;
  const claimContact = process.env.CLAIM_CONTACT_EMAIL ?? "hello@logr.life";
  return <Portfolio profile={profile} chatEnabled={chatEnabled} loggedIn={loggedIn} claimContact={claimContact} />;
}
