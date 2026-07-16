// Agentic site crawl for "site" sources: an LLM tool-loop picks the most
// promising same-origin pages (about, projects, blog, talks, cv) within a
// small page budget. The narrate pass consumes the raw visited page texts
// plus each page's links — not the model's summary — so exact dates, URLs,
// and proof links (tweets, posts, repos) survive into events and media.
// External links are returned for depth-1 source discovery (github, feeds…).

import { generateText, tool, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { fetchUrlPage, type PageLink } from "@/lib/import";
import { CHAT_MODEL } from "@/lib/chat";

const PAGE_BUDGET = 6; // total pages fetched per site, root included
const PAGE_SLICE = 6000; // chars of a page shown to the crawl model
const OUT_SLICE = 24000; // chars of combined page text handed to extraction
const LINKS_PER_PAGE = 30; // links listed under each page in the output

export type CrawlResult = { text: string; external: string[] };

function linksSection(links: PageLink[]): string {
  const lines = links
    .slice(0, LINKS_PER_PAGE)
    .map((l) => `- ${l.text || "(link)"}: ${l.href}`);
  return lines.length ? `LINKS ON THIS PAGE:\n${lines.join("\n")}` : "";
}

export async function crawlSite(rootUrl: string): Promise<CrawlResult> {
  const root = await fetchUrlPage(rootUrl);
  const visited = new Map<string, { text: string; links: PageLink[] }>([[rootUrl, root]]);

  const internal = root.links.filter((l) => !l.external);

  // Single-page sites still work: the root alone feeds extraction.
  if (internal.length > 0) {
    let origin: string;
    try {
      origin = new URL(rootUrl).origin;
    } catch {
      origin = "";
    }

    const fetchPage = tool({
      description: "Fetch another page on this same site and return its readable text.",
      inputSchema: z.object({ url: z.string().describe("absolute URL on the same site") }),
      execute: async ({ url }) => {
        if (visited.size >= PAGE_BUDGET) return "PAGE BUDGET EXHAUSTED — stop fetching.";
        let u: URL;
        try {
          u = new URL(url);
        } catch {
          return "invalid url";
        }
        u.hash = "";
        if (u.origin !== origin) return "off-site link — skipped";
        if (visited.has(u.href)) return "already fetched";
        try {
          const p = await fetchUrlPage(u.href);
          visited.set(u.href, p);
          return p.text.slice(0, PAGE_SLICE) || "(page is empty)";
        } catch (e) {
          return `fetch failed: ${e instanceof Error ? e.message : "error"}`;
        }
      },
    });

    try {
      await generateText({
        model: createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! }).chat(CHAT_MODEL),
        tools: { fetchPage },
        stopWhen: stepCountIs(PAGE_BUDGET + 1),
        system:
          "You are gathering a person's career facts from their own website. " +
          `Fetch every page likely to list their work (about, projects, work, blog, talks, cv, portfolio, achievements) — up to ${PAGE_BUDGET - 1} more. ` +
          "When you have seen enough, reply with the single word DONE.",
        prompt:
          `Home page of ${rootUrl}:\n\n${root.text.slice(0, PAGE_SLICE)}\n\n` +
          `Site links:\n${internal.map((l) => `- ${l.text || "(no text)"}: ${l.href}`).join("\n").slice(0, 3000)}`,
        temperature: 0,
      });
    } catch {
      // Crawl expansion is best-effort — the root page alone is still useful.
    }
  }

  const external = [
    ...new Set([...visited.values()].flatMap((p) => p.links.filter((l) => l.external).map((l) => l.href))),
  ];

  const text = [...visited.entries()]
    .map(([u, p]) => `PAGE: ${u}\n${p.text}\n${linksSection(p.links)}`)
    .join("\n\n")
    .slice(0, OUT_SLICE);

  return { text, external };
}
