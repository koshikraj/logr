import type { Metadata } from "next";
import { Landing } from "@/components/marketing/Landing";
import { getUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "logr — the story a resume can't tell" },
  description:
    "A resume, LinkedIn, or bio can't tell your whole story — or speak to the agents now reading on someone's behalf. Log every event once: a timeline humans read and an llm.txt any agent can ingest.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "logr",
    title: "logr — the story a resume can't tell",
    description:
      "Log every event once: a timeline humans read and an llm.txt any agent can ingest.",
  },
};

// Reads the session to tailor the nav CTA, so render per-request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const signedIn = Boolean(await getUserId());
  return <Landing signedIn={signedIn} />;
}
