import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extract", () => ({
  EXTRACT_HINTS: { site: "site" },
  extractEvents: vi.fn(),
}));
vi.mock("@/lib/import", () => ({ fetchUrlText: vi.fn() }));
vi.mock("@/lib/import-sources", () => ({ fetchLinkedIn: vi.fn() }));

import { extractEvents } from "@/lib/extract";
import { fetchUrlText } from "@/lib/import";
import { fetchLinkedIn } from "@/lib/import-sources";
import { importUrl } from "@/lib/import-url";

const extract = vi.mocked(extractEvents);
const fetchPage = vi.mocked(fetchUrlText);
const fetchLinkedInProfile = vi.mocked(fetchLinkedIn);

beforeEach(() => {
  vi.clearAllMocks();
  extract.mockResolvedValue([]);
});

describe("importUrl", () => {
  it("uses the configured LinkedIn importer instead of fetching LinkedIn HTML", async () => {
    fetchLinkedInProfile.mockResolvedValue("profile facts");

    await expect(importUrl("https://www.linkedin.com/in/example-person")).resolves.toEqual({ ok: true, events: [] });

    expect(fetchLinkedInProfile).toHaveBeenCalledWith("https://www.linkedin.com/in/example-person");
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("returns a PDF-export instruction when LinkedIn scraping is unavailable", async () => {
    fetchLinkedInProfile.mockRejectedValue(
      new Error("LinkedIn import isn't configured — upload your LinkedIn PDF export instead.")
    );

    await expect(importUrl("https://linkedin.com/in/example-person")).resolves.toEqual({
      ok: false,
      error: "LinkedIn import isn't configured — upload your LinkedIn PDF export instead.",
    });
  });

  it("returns an actionable message instead of an unexpected server error", async () => {
    fetchPage.mockRejectedValue(new Error("socket closed"));

    await expect(importUrl("https://example.com")).resolves.toEqual({
      ok: false,
      error: "Could not extract events from that URL. Try a public portfolio or a LinkedIn PDF export.",
    });
  });
});
