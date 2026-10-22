import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedResume } from "@/lib/resume-data";
import { snippet } from "@/lib/seo";
import { ResumePublicPage } from "@/components/resume/ResumePublicPage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublishedResume(username);
  // 404 from metadata too, so streaming can't commit a 200 before the body
  if (!data) notFound();
  const { profile, resume } = data;
  const title = `${profile.name} — resume`;
  const description = snippet(resume.document.header.headline || profile.bio, 160);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${username}/resume` },
    // a functional twin of the profile — shareable, but the timeline is the canonical page
    robots: { index: false, follow: true },
    openGraph: { type: "profile", url: `/${username}/resume`, siteName: "logr", title, description, username },
    twitter: { card: "summary_large_image", site: "@uselogr" },
  };
}

export default async function ResumePage({ params }: Params) {
  const { username } = await params;
  const data = await getPublishedResume(username);
  if (!data) notFound();
  return <ResumePublicPage profile={data.profile} resume={data.resume} />;
}
