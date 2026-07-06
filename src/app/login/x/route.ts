import { signIn, isXAuthEnabled } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// GET /login/x — jump straight into the X OAuth screen (used by the claim
// dialog on seeded profiles). Lands on /welcome, where a verified handle
// matching an attributed profile shows the claim card.
export async function GET() {
  if (!isXAuthEnabled()) redirect("/login");
  await signIn("twitter", { redirectTo: "/welcome" });
}
