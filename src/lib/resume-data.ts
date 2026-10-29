// Resume persistence (#66). Server-only reads shared by the server actions and
// the public /[username]/resume page; all writes go through lib/actions.ts.

import "server-only";
import { prisma } from "@/lib/db";
import { getProfile, type ProfileDTO } from "@/lib/profile";
import {
  DEFAULT_RESUME_PAGES,
  DEFAULT_RESUME_TEMPLATE,
  isResumePageCount,
  isResumePageSize,
  isResumeTemplate,
  parseResumeDocument,
  type ResumeDocument,
  type ResumeSettings,
} from "@/lib/resume";

export type ResumeView = ResumeSettings & {
  document: ResumeDocument;
  generatedAt: string | null;
  updatedAt: string;
};

type ResumeRow = {
  template: string;
  pageSize: string;
  pages: number;
  published: boolean;
  document: string;
  generatedAt: Date | null;
  updatedAt: Date;
};

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Row → view, healing unknown settings; null when the stored doc is invalid. */
export function toResumeView(row: ResumeRow): ResumeView | null {
  const document = parseResumeDocument(parseJSON(row.document));
  if (!document) return null;
  return {
    template: isResumeTemplate(row.template) ? row.template : DEFAULT_RESUME_TEMPLATE,
    pageSize: isResumePageSize(row.pageSize) ? row.pageSize : "A4",
    pages: isResumePageCount(row.pages) ? row.pages : DEFAULT_RESUME_PAGES,
    published: row.published,
    document,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getResumeForProfile(profileId: string): Promise<ResumeView | null> {
  const row = await prisma.resume.findUnique({ where: { profileId } });
  return row ? toResumeView(row) : null;
}

/** The public resume: only when the profile is publicly visible AND the owner
 *  published it. Same gating as every other public surface (getProfile). */
export async function getPublishedResume(
  username: string
): Promise<{ profile: ProfileDTO; resume: ResumeView } | null> {
  const profile = await getProfile(username);
  if (!profile?.resumePublished) return null;
  const resume = await getResumeForProfile(profile.id);
  if (!resume?.published) return null;
  return { profile, resume };
}
