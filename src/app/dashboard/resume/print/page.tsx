import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentProfileId } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { getResumeForProfile } from "@/lib/resume-data";
import { ResumePrintStyle, ResumeSheet } from "@/components/resume/ResumeSheet";
import { AutoPrint } from "@/components/resume/PrintButton";

export const metadata = { title: "print resume", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Owner-only print view of the current (possibly unpublished) resume.
 *  The dashboard's "download pdf" opens this in a new tab, which prints itself. */
export default async function ResumePrintPage() {
  const profileId = await currentProfileId();
  if (!profileId) redirect("/login");
  const row = await prisma.profile.findUnique({ where: { id: profileId }, select: { username: true } });
  const profile = row ? await getProfile(row.username) : null;
  const resume = await getResumeForProfile(profileId);
  if (!profile || !resume) redirect("/dashboard");
  return (
    <div style={{ background: "#e9e7e2", minHeight: "100dvh", padding: 24 }}>
      <ResumePrintStyle pageSize={resume.pageSize} />
      <AutoPrint />
      <ResumeSheet doc={resume.document} template={resume.template} pageSize={resume.pageSize} theme={profile.theme} id="resume" />
    </div>
  );
}
