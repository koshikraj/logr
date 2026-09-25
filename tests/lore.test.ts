import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { describe, it, expect } from "vitest";
import { buildLorePrompt } from "@/lib/lore";

describe("buildLorePrompt", () => {
  it("orders events oldest-first and tags source hosts", () => {
    const p = buildLorePrompt({
      name: "Koshik Raj",
      bio: "Builder of logr",
      status: "",
      location: "",
      about: null,
      socials: [],
      events: [
        { dateOn: "2025-01-01", title: "Shipped logr", body: "b", tags: ["work"], featured: true, sources: ["https://github.com/koshikraj/logr"] },
        { dateOn: "2021-06-01", title: "First talk", body: "b", tags: ["talk"], featured: false, sources: [] },
      ],
    });
    expect(p.indexOf("First talk")).toBeLessThan(p.indexOf("Shipped logr"));
    expect(p).toContain("(via github.com)");
    expect(p).toContain("Shipped logr ★");
  });
});
