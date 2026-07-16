// Shared types for AI event extraction and the magical-onboarding import
// pipeline. Plain types only — imported by both client components and
// server code (route handler, server actions).

export type MediaInput = {
  kind: "image" | "video" | "link" | "tweet" | "instagram";
  url: string;
  poster: string | null;
  provider: string | null;
  title: string | null;
};

export type ReviewEvent = {
  dateOn: string;
  fullDate: boolean;
  title: string;
  tags: string[];
  featured: boolean;
  body: string;
  // optional — absent from AI extraction, settable in the review editor
  icon?: string | null;
  linkLabel?: string | null;
  linkHref?: string | null;
  // which pasted source produced this event (null for typed narratives/files)
  sourceUrl?: string | null;
  media: MediaInput[];
};

// ---------- import job (background source parsing) ----------

export type SourceKind =
  | "github"
  | "rss"
  | "devto"
  | "youtube"
  | "site"
  | "linkedin"
  | "twitter"
  | "resume"
  | "linkedin-pdf";

export type SourceStatus = "queued" | "fetching" | "extracting" | "done" | "error";

export type SourceChip = {
  id: string;
  kind: SourceKind;
  label: string;
  status: SourceStatus;
  eventCount: number;
  error?: string;
};

/** One JSON object per newline on the /api/import response stream. */
export type ImportStreamEvent =
  | { type: "job"; jobId: string; sources: SourceChip[] }
  | { type: "source-status"; sourceId: string; status: "fetching" | "extracting" }
  | { type: "source-done"; sourceId: string; events: ReviewEvent[] }
  | { type: "source-error"; sourceId: string; message: string }
  | { type: "merged"; events: ReviewEvent[] }
  | { type: "done" };
