import { describe, it, expect } from "vitest";
import type { EventDTO, ProfileDTO } from "@/lib/profile";
import {
  applyPolish,
  decodeEntities,
  generateResumeDocument,
  linkLabel,
  mergeResumeDocument,
  parseResumeDocument,
  reconcileExclusions,
  RESUME_LIMITS,
  resumeOverflow,
  safeHref,
  sectionTypeForTags,
  suggestTemplate,
  toBullets,
  validateResumeDocument,
  type ResumeDocument,
} from "@/lib/resume";
import { parsePolish } from "@/lib/resume-ai";
import { generateLlmTxt, generatePrimaryLlmsTxt } from "@/lib/llmtxt";

function event(id: string, dateOn: string, tags: string[], overrides: Partial<EventDTO> = {}): EventDTO {
  return {
    id,
    dateOn,
    date: dateOn,
    year: Number(dateOn.slice(0, 4)),
    title: `Event ${id}`,
    tags,
    featured: false,
    fullDate: false,
    body: "Shipped the thing. It worked well! Then iterated on it. A fourth sentence.",
    icon: null,
    link: null,
    sourceUrl: null,
    media: [],
    ...overrides,
  };
}

function profile(events: EventDTO[], overrides: Partial<ProfileDTO> = {}): ProfileDTO {
  return {
    id: "p1",
    username: "koshik",
    claimStatus: "owned",
    name: "Koshik Raj",
    bio: "Builder of logr",
    status: "building logr",
    location: "Bengaluru",
    about: "Longer form about.",
    avatarUrl: "/uploads/a.png",
    socials: [
      { label: "GitHub", href: "https://github.com/koshikraj" },
      { label: "Email", href: "mailto:k@example.com" },
    ],
    theme: {} as ProfileDTO["theme"],
    pinnedIds: [],
    events,
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const EVENTS = [
  event("e5", "2026-04-15", ["work", "milestone"], { fullDate: true, icon: "🚀" }),
  event("e4", "2025-11-01", ["side_quest"], {
    link: { label: "repo", href: "https://github.com/x/y" },
    media: [{ kind: "image", url: "/uploads/shot.png", poster: null, provider: null, title: null }],
  }),
  event("e3", "2025-06-01", ["talk"]),
  event("e2", "2024-02-01", ["writing"]),
  event("e1", "2023-01-01", ["milestone"]),
];

const ids = (doc: ResumeDocument, type: string) =>
  doc.sections.find((s) => s.type === type)?.items.map((i) => i.eventId) ?? [];

describe("generateResumeDocument", () => {
  it("maps profile to header and events to sections by tag, in order", () => {
    const doc = generateResumeDocument(profile(EVENTS));
    expect(doc.header).toMatchObject({
      name: "Koshik Raj",
      headline: "building logr",
      location: "Bengaluru",
      email: "k@example.com",
      links: [{ label: "GitHub", href: "https://github.com/koshikraj", icon: null }],
    });
    expect(doc.sections.map((s) => s.type)).toEqual([
      "summary",
      "experience",
      "projects",
      "achievements",
      "talks",
      "writing",
    ]);
    expect(doc.sections[0].text).toBe("Longer form about.");
    expect(ids(doc, "experience")).toEqual(["e5"]); // work wins over milestone
    expect(ids(doc, "achievements")).toEqual(["e1"]);
    expect(parseResumeDocument(doc)).toEqual(doc); // generator output is schema-valid
  });

  it("builds items with dates, bullets, link, icon, and image", () => {
    const doc = generateResumeDocument(profile(EVENTS));
    const exp = doc.sections.find((s) => s.type === "experience")!.items[0];
    expect(exp).toMatchObject({ eventId: "e5", dateFrom: "2026-04-15", dateTo: null, icon: "🚀" });
    expect(exp.bullets).toHaveLength(3);
    const proj = doc.sections.find((s) => s.type === "projects")!.items[0];
    expect(proj).toMatchObject({ dateFrom: "2025-11", link: { label: "repo", href: "https://github.com/x/y" }, image: "/uploads/shot.png" });
  });

  it("skips excluded events and omits empty sections", () => {
    const doc = generateResumeDocument(profile(EVENTS, { about: null, bio: "" }), ["e3"]);
    expect(doc.sections.find((s) => s.type === "talks")).toBeUndefined();
    expect(doc.sections.find((s) => s.type === "summary")).toBeUndefined();
    expect(doc.excludedEventIds).toEqual(["e3"]);
  });
});

describe("helpers", () => {
  it("routes common custom tags", () => {
    expect(sectionTypeForTags(["education"])).toBe("education");
    expect(sectionTypeForTags(["Hackathon"])).toBe("projects");
    expect(sectionTypeForTags(["podcast"])).toBe("talks");
    expect(sectionTypeForTags(["something-else"])).toBe("achievements");
  });

  it("splits bodies into sentence bullets", () => {
    expect(toBullets("One. Two! Three? Four.", 3)).toEqual(["One.", "Two!", "Three?"]);
    expect(toBullets("v1.2 shipped to e.g. users", 3)).toEqual(["v1.2 shipped to e.g. users"]);
    expect(toBullets("   ")).toEqual([]);
  });

  it("only allows web and mail hrefs", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("https://a.b")).toBe("https://a.b");
    expect(safeHref("me@x.io")).toBe("mailto:me@x.io");
  });

  it("suggests a template from the log's shape", () => {
    const talky = profile([event("a", "2025-01-01", ["talk"]), event("b", "2025-01-01", ["writing"])]);
    expect(suggestTemplate(generateResumeDocument(talky))).toBe("academic");
    const builder = profile([event("a", "2025-01-01", ["side_quest"]), event("b", "2024-01-01", ["side_quest"])]);
    expect(suggestTemplate(generateResumeDocument(builder))).toBe("founder");
    expect(suggestTemplate(generateResumeDocument(profile([event("a", "2025-01-01", ["work"])])))).toBe("modern");
  });
});

describe("parseResumeDocument", () => {
  it("rejects malformed input and scrubs unsafe links", () => {
    expect(parseResumeDocument(null)).toBeNull();
    expect(parseResumeDocument({ version: 2 })).toBeNull();
    const doc = generateResumeDocument(profile(EVENTS));
    doc.header.links.push({ label: "x", href: "javascript:alert(1)", icon: null });
    doc.sections[1].items[0].link = { label: "bad", href: "javascript:void(0)" };
    doc.sections[1].items[0].image = "javascript:x";
    const clean = parseResumeDocument(JSON.parse(JSON.stringify(doc)))!;
    expect(clean.header.links.map((l) => l.href)).toEqual(["https://github.com/koshikraj"]);
    expect(clean.sections[1].items[0].link).toBeNull();
    expect(clean.sections[1].items[0].image).toBeNull();
  });

  it("rejects bad dates", () => {
    const doc = generateResumeDocument(profile(EVENTS));
    doc.sections[1].items[0].dateFrom = "April 2026";
    expect(parseResumeDocument(doc)).toBeNull();
    doc.sections[1].items[0].dateFrom = "2026";
    doc.sections[1].items[0].dateTo = "present";
    expect(parseResumeDocument(doc)).not.toBeNull();
  });
});

describe("mergeResumeDocument (regenerate)", () => {
  it("keeps edits, drops deleted events, adds new ones in date order", () => {
    const base = generateResumeDocument(profile(EVENTS));
    // owner edits: retitle a section, edit an item, reorder sections
    base.sections[1].title = "Work";
    base.sections[1].items[0].title = "Founder, logr";
    base.sections.reverse();

    const newer = event("e6", "2026-09-01", ["work"]);
    const older = event("e0", "2020-01-01", ["work"]);
    const live = [newer, ...EVENTS.filter((e) => e.id !== "e3"), older]; // e3 deleted
    const merged = mergeResumeDocument(base, profile(live));

    expect(merged.sections.map((s) => s.type)).toEqual(base.sections.map((s) => s.type)); // owner's order kept
    const exp = merged.sections.find((s) => s.type === "experience")!;
    expect(exp.title).toBe("Work");
    expect(exp.items.map((i) => i.eventId)).toEqual(["e6", "e5", "e0"]);
    expect(exp.items[1].title).toBe("Founder, logr");
    expect(merged.sections.find((s) => s.type === "talks")!.items).toEqual([]);
  });

  it("never re-adds excluded events and creates missing sections at the end", () => {
    const base = generateResumeDocument(profile([event("w", "2025-01-01", ["work"])]));
    base.excludedEventIds = ["t1"];
    const merged = mergeResumeDocument(
      base,
      profile([event("w", "2025-01-01", ["work"]), event("t1", "2025-02-01", ["talk"]), event("t2", "2025-03-01", ["talk"])])
    );
    expect(merged.sections.at(-1)!.type).toBe("talks");
    expect(ids(merged, "talks")).toEqual(["t2"]);
    expect(merged.excludedEventIds).toEqual(["t1"]);
  });

  it("does not resurrect a summary the owner removed", () => {
    const base = generateResumeDocument(profile(EVENTS));
    base.sections = base.sections.filter((s) => s.type !== "summary");
    expect(mergeResumeDocument(base, profile(EVENTS)).sections.some((s) => s.type === "summary")).toBe(false);
  });
});

describe("reconcileExclusions", () => {
  it("excludes removed events and un-excludes re-added ones", () => {
    const prev = generateResumeDocument(profile(EVENTS));
    const next = structuredClone(prev);
    next.sections = next.sections.filter((s) => s.type !== "talks");
    next.excludedEventIds = ["e1"]; // stale: e1 is still on the resume
    const out = reconcileExclusions(prev, next);
    expect(out.excludedEventIds.sort()).toEqual(["e3"]);
  });
});

describe("AI polish", () => {
  const doc = generateResumeDocument(profile(EVENTS));
  const itemId = doc.sections[1].items[0].id;

  it("parses fenced JSON, drops unknown ids and bad templates", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        summary: " Builds things. ",
        template: "neon",
        bullets: { [itemId]: ["- Led launch", "", 3], nope: ["x"] },
      }) +
      "\n```";
    const p = parsePolish(raw, doc);
    expect(p.summary).toBe("Builds things.");
    expect(p.template).toBe(suggestTemplate(doc));
    expect(p.bullets).toEqual({ [itemId]: ["Led launch"] });
  });

  it("falls back on garbage", () => {
    expect(parsePolish("sorry, no", doc)).toEqual({ summary: null, template: suggestTemplate(doc), bullets: {} });
  });

  it("applies a polish without touching other items", () => {
    const out = applyPolish(doc, { summary: "New summary", template: "classic", bullets: { [itemId]: ["Led launch"] } });
    expect(out.sections[0].text).toBe("New summary");
    expect(out.sections[1].items[0].bullets).toEqual(["Led launch"]);
    expect(out.sections[2].items[0].bullets).toEqual(doc.sections[2].items[0].bullets);
  });
});

describe("llms.txt resume link", () => {
  it("links the resume only when published", () => {
    expect(generateLlmTxt(profile(EVENTS), "https://logr.it")).not.toContain("Resume:");
    expect(generateLlmTxt(profile(EVENTS, { resumePublished: true }), "https://logr.it")).toContain(
      "- Resume: https://logr.it/koshik/resume"
    );
    const big = profile(
      Array.from({ length: 400 }, (_, i) => event(`b${i}`, "2025-01-01", ["work"], { body: "x".repeat(200) })),
      { resumePublished: true }
    );
    expect(generatePrimaryLlmsTxt(big, "https://logr.it")).toContain("[Resume](https://logr.it/koshik/resume)");
  });
});

describe("review fixes", () => {
  it("clamps huge categories to the item cap and stays valid", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      event(`w${i}`, `20${String(10 + (i % 15)).padStart(2, "0")}-01-01`, ["work"])
    );
    const doc = generateResumeDocument(profile(many));
    expect(doc.sections.find((s) => s.type === "experience")!.items).toHaveLength(RESUME_LIMITS.itemsPerSection);
    expect(parseResumeDocument(JSON.parse(JSON.stringify(doc)))).not.toBeNull();
    // merge into a full section never exceeds the cap either
    const merged = mergeResumeDocument(doc, profile([event("new", "2030-01-01", ["work"]), ...many]));
    expect(merged.sections.find((s) => s.type === "experience")!.items.length).toBeLessThanOrEqual(
      RESUME_LIMITS.itemsPerSection
    );
    expect(parseResumeDocument(merged)).not.toBeNull();
  });

  it("orders items newest first regardless of timeline position", () => {
    const doc = generateResumeDocument(
      profile([
        event("a", "2026-02-01", ["work"]),
        event("b", "2026-04-01", ["work"]),
        event("c", "2025-01-01", ["work"]),
      ])
    );
    expect(ids(doc, "experience")).toEqual(["b", "a", "c"]);
  });

  it("drops a first bullet that just repeats the title", () => {
    const doc = generateResumeDocument(
      profile([event("a", "2026-02-01", ["work"], { title: "Built Zhentan", body: "Built Zhentan. Won the hackathon." })])
    );
    expect(doc.sections.find((s) => s.type === "experience")!.items[0].bullets).toEqual(["Won the hackathon."]);
  });

  it("decodes entities and shortens page-title link labels", () => {
    expect(decodeEntities("Bengaluru&#x27;s &amp; co &#39;x&#39;")).toBe("Bengaluru's & co 'x'");
    expect(linkLabel("repo", "https://github.com/x/y")).toBe("repo");
    expect(linkLabel("#blockchain | Koshik Raj | 12 comments", "https://www.linkedin.com/posts/x")).toBe("linkedin.com");
    const doc = generateResumeDocument(
      profile([
        event("a", "2026-02-01", ["work"], {
          media: [{ kind: "link", url: "https://a.io/p", poster: null, provider: null, title: "Bengaluru&#x27;s best" }],
        }),
      ])
    );
    expect(doc.sections.find((s) => s.type === "experience")!.items[0].link).toEqual({
      label: "Bengaluru's best",
      href: "https://a.io/p",
    });
  });

  it("does not repeat a bare-email social as a header link", () => {
    const doc = generateResumeDocument(
      profile([], { socials: [{ label: "Email", href: "me@x.io" }, { label: "GitHub", href: "https://github.com/me" }] })
    );
    expect(doc.header.email).toBe("me@x.io");
    expect(doc.header.links.map((l) => l.href)).toEqual(["https://github.com/me"]);
  });

  it("validates real dates and reports where a document is invalid", () => {
    const doc = generateResumeDocument(profile(EVENTS));
    const item = doc.sections[1].items[0];
    item.dateFrom = "2024-13-45";
    const bad = validateResumeDocument(doc);
    expect(bad).toMatchObject({ ok: false });
    expect(!bad.ok && bad.error).toContain("sections.1.items.0.dateFrom");
    item.dateFrom = "present";
    expect(parseResumeDocument(doc)).toBeNull();
    item.dateFrom = "2024-02";
    item.dateTo = "present";
    expect(parseResumeDocument(doc)).not.toBeNull();
  });

  it("rejects overlong URLs instead of truncating them", () => {
    expect(safeHref(`https://a.io/${"x".repeat(600)}`)).toBeNull();
  });

  it("reconciles exclusions without a previous document", () => {
    const next = generateResumeDocument(profile(EVENTS));
    next.excludedEventIds = ["e1", "gone"];
    expect(reconcileExclusions(null, next).excludedEventIds).toEqual(["gone"]);
  });

  it("only suggests creative for visual-first logs", () => {
    const img = { kind: "image" as const, url: "/u/a.png", poster: null, provider: null, title: null };
    const workHeavy = profile(
      Array.from({ length: 10 }, (_, i) => event(`w${i}`, "2025-01-01", ["work"], { media: [img] }))
    );
    expect(suggestTemplate(generateResumeDocument(workHeavy))).toBe("modern");
    const visual = profile(
      Array.from({ length: 6 }, (_, i) => event(`m${i}`, "2025-01-01", ["milestone"], { media: [img] }))
    );
    expect(suggestTemplate(generateResumeDocument(visual))).toBe("creative");
  });
});

describe("section overflow", () => {
  const cap = RESUME_LIMITS.itemsPerSection;
  const old = Array.from({ length: cap + 5 }, (_, i) =>
    event(`o${i}`, `20${String(10 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}-01`, ["work"])
  );

  it("reports events that don't fit on generate", () => {
    const p = profile(old);
    expect(resumeOverflow(generateResumeDocument(p), p)).toBe(5);
  });

  it("sync lets a new recent event in by evicting the oldest log item, never free-form ones", () => {
    const base = generateResumeDocument(profile(old));
    const exp = base.sections.find((s) => s.type === "experience")!;
    const freeform = { ...exp.items[0], id: "free1", eventId: null, title: "Free", dateFrom: "2000-01" };
    exp.items = [...exp.items.slice(0, cap - 1), freeform];
    const fresh = event("new", "2031-01-01", ["work"]);
    const p = profile([fresh, ...old]);
    const merged = mergeResumeDocument(base, p);
    const items = merged.sections.find((s) => s.type === "experience")!.items;
    expect(items).toHaveLength(cap);
    expect(items[0].eventId).toBe("new");
    expect(items.some((i) => i.id === "free1")).toBe(true);
    expect(resumeOverflow(merged, p)).toBe(old.length + 1 - (cap - 1));
  });
});
