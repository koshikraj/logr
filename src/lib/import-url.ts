import { extractEvents, EXTRACT_HINTS } from "@/lib/extract";
import { fetchUrlText } from "@/lib/import";
import { classifySource } from "@/lib/import-classify";
import { fetchLinkedIn } from "@/lib/import-sources";
import type { ReviewEvent } from "@/lib/import-types";

export type UrlImportResult =
  | { ok: true; events: ReviewEvent[] }
  | { ok: false; error: string };

const FALLBACK_ERROR = "Could not extract events from that URL. Try a public portfolio or a LinkedIn PDF export.";

function userFacingImportError(error: unknown): string {
  if (!(error instanceof Error)) return FALLBACK_ERROR;

  // These messages are intentionally authored for the import UI. Do not pass
  // through unexpected server errors, which Next redacts in production anyway.
  const message = error.message;
  if (
    /^(Invalid URL\.|Only HTTP and HTTPS URLs are supported\.|That URL is not accessible\.|Could not resolve that host\.|Could not fetch that page\.|Could not fetch page \(\d+\)\.|LinkedIn import isn't configured — upload your LinkedIn PDF export instead\.|LinkedIn scrape timed out — try again in a few minutes\.|Bright Data (?:rejected the API key\.|couldn't read that LinkedIn profile\.|returned (?:no profile data|\d+).))$/.test(message)
  ) {
    return message;
  }
  return FALLBACK_ERROR;
}

/** Import a supported public URL without leaking server-action errors to the client. */
export async function importUrl(url: string): Promise<UrlImportResult> {
  const source = classifySource(url);
  try {
    const text = source?.kind === "linkedin"
      ? await fetchLinkedIn(source.url)
      : await fetchUrlText(url);
    return { ok: true, events: await extractEvents(text, EXTRACT_HINTS.site) };
  } catch (error) {
    return { ok: false, error: userFacingImportError(error) };
  }
}
