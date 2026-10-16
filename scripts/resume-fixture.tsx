// Dev-only: render every resume template to static HTML for a visual check.
// Usage: npx tsx scripts/resume-fixture.tsx /tmp/resume-fixtures [pages=1,2,3]
// The fit-to-pages pass runs client-side (ResumeSheet), so each fixture
// carries a tiny inline script that replays the same FIT_STEPS ladder.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { RESUME_TEMPLATES, type ResumeDocument } from "../src/lib/resume";
import { FIT_STEPS, PAGE_DIMENSIONS } from "../src/lib/resume-format";
import { DEFAULT_THEME } from "../src/lib/theme";
import { ResumeSheet } from "../src/components/resume/ResumeSheet";

const doc: ResumeDocument = {
  version: 1,
  header: {
    name: "Koshik Raj",
    headline: "Building logr — a life-log humans read and agents can ask",
    location: "Bengaluru, IN",
    email: "koshik@logr.it",
    avatarUrl: "https://i.pravatar.cc/160?img=12",
    showAvatar: true,
    links: [
      { label: "github.com/koshikraj", href: "https://github.com/koshikraj", icon: "lucide:code" },
      { label: "x.com/koshikraj", href: "https://x.com/koshikraj", icon: "lucide:at-sign" },
      { label: "koshik.me", href: "https://koshik.me", icon: "lucide:globe" },
    ],
  },
  accent: null,
  excludedEventIds: [],
  sections: [
    { id: "sec_summary", type: "summary", title: "Summary", icon: "lucide:sparkles", hidden: false, text: "Engineer and founder working at the edge of identity and AI agents. Shipped three products from zero to live users, two of them open source. Speaks and writes about wallets, portable identity and agent-native data.", items: [] },
    {
      id: "sec_experience", type: "experience", title: "Experience", icon: "lucide:briefcase", hidden: false, text: null,
      items: [
        { id: "it1", eventId: "e1", title: "Founder & Engineer", subtitle: "logr", location: "Remote", dateFrom: "2026-03", dateTo: "present", bullets: ["Designed the life-log data model and the llms.txt context layer agents consume.", "Built the global MCP server with OAuth 2.1 and six read tools.", "Grew to 400 public profiles in the first quarter."], link: { label: "logr.it", href: "https://logr.it" }, icon: "lucide:rocket", image: "https://picsum.photos/seed/logr/320/240" },
        { id: "it2", eventId: "e2", title: "Senior Engineer, Wallet Platform", subtitle: "Safe", location: "Berlin", dateFrom: "2022-01", dateTo: "2026-02", bullets: ["Led the account-abstraction SDK used by 120 integrators.", "Cut transaction simulation latency by 60% with a batched RPC layer."], link: null, icon: "lucide:cpu", image: null },
      ],
    },
    {
      id: "sec_projects", type: "projects", title: "Projects", icon: "lucide:rocket", hidden: false, text: null,
      items: [
        { id: "it3", eventId: "e3", title: "Zhentan", subtitle: "Onchain co-signer", location: null, dateFrom: "2025-09", dateTo: null, bullets: ["Screens pending multisig transactions against behavioural patterns and auto-signs the safe ones."], link: { label: "github", href: "https://github.com/zhentan" }, icon: "🛡️", image: "https://picsum.photos/seed/zhentan/320/240" },
        { id: "it4", eventId: "e4", title: "Ottopus", subtitle: "Agent stock desk", location: null, dateFrom: "2025-11", dateTo: null, bullets: ["Built at BNB Hack; picks the wallet, builds the route, simulates and hands back a review link."], link: { label: "ottopus.xyz", href: "https://ottopus.xyz" }, icon: "🐙", image: "https://picsum.photos/seed/otto/320/240" },
        { id: "it5", eventId: "e5", title: "Pottery studio", subtitle: "Side quest", location: "Bengaluru", dateFrom: "2024", dateTo: null, bullets: ["Threw 200 pots in a year and sold 60 of them."], link: null, icon: "🏺", image: "https://picsum.photos/seed/pots/320/240" },
      ],
    },
    {
      id: "sec_talks", type: "talks", title: "Talks", icon: "lucide:mic", hidden: false, text: null,
      items: [
        { id: "it6", eventId: "e6", title: "Portable identity for the agent era", subtitle: "ETHGlobal Bangkok", location: "Bangkok", dateFrom: "2025-11-14", dateTo: null, bullets: [], link: { label: "slides", href: "https://example.com/slides" }, icon: null, image: null },
        { id: "it7", eventId: "e7", title: "What wallets owe their users", subtitle: "Devcon", location: "Bangkok", dateFrom: "2024-11", dateTo: null, bullets: ["Keynote on account abstraction trade-offs."], link: null, icon: null, image: null },
      ],
    },
    {
      id: "sec_writing", type: "writing", title: "Writing", icon: "lucide:pen-line", hidden: false, text: null,
      items: [
        { id: "it8", eventId: "e8", title: "llms.txt for people", subtitle: "Essay", location: null, dateFrom: "2026-01", dateTo: null, bullets: ["Why every person needs a machine-readable context file."], link: { label: "read", href: "https://logr.it/blog/llms-txt" }, icon: null, image: null },
        { id: "it9", eventId: "e9", title: "Whitepaper: optimistic verification for life-logs", subtitle: "Preprint", location: null, dateFrom: "2025-06", dateTo: null, bullets: [], link: null, icon: null, image: null },
      ],
    },
    { id: "sec_achievements", type: "achievements", title: "Achievements", icon: "lucide:trophy", hidden: false, text: null, items: [
      { id: "it10", eventId: "e10", title: "Finalist, BNB Hack Tokenized Stocks", subtitle: null, location: null, dateFrom: "2025-12", dateTo: null, bullets: [], link: null, icon: "🏆", image: null },
      { id: "it11", eventId: "e11", title: "Ran the Bengaluru marathon", subtitle: "4:12", location: null, dateFrom: "2024-10-06", dateTo: null, bullets: [], link: null, icon: "🏃", image: null },
    ] },
    { id: "sec_skills", type: "skills", title: "Skills", icon: "lucide:wrench", hidden: false, text: null, items: [
      { id: "it12", eventId: null, title: "TypeScript · React · Next.js", subtitle: null, location: null, dateFrom: null, dateTo: null, bullets: [], link: null, icon: null, image: null },
      { id: "it13", eventId: null, title: "Postgres · Prisma", subtitle: null, location: null, dateFrom: null, dateTo: null, bullets: [], link: null, icon: null, image: null },
      { id: "it14", eventId: null, title: "Solidity · account abstraction", subtitle: null, location: null, dateFrom: null, dateTo: null, bullets: [], link: null, icon: null, image: null },
    ] },
    { id: "sec_hidden", type: "custom", title: "Hidden section", icon: null, hidden: true, text: "should not render", items: [] },
  ],
};

// BIG=1 triples every section's items to exercise the fit ladder + overflow warning
if (process.env.BIG) for (const s of doc.sections) s.items = [0, 1, 2].flatMap((k) => s.items.map((i) => ({ ...i, id: `${i.id}_${k}`, eventId: null })));
const out = process.argv[2] ?? "/tmp/resume-fixtures";
const pageCounts = (process.argv[3] ?? "2").split(",").map(Number) as (1 | 2 | 3 | 4)[];
mkdirSync(out, { recursive: true });
const css = readFileSync(new URL("../src/app/resume.css", import.meta.url), "utf8");
const pageH = PAGE_DIMENSIONS.A4.px.height;
// same loop as ResumeSheet.run(), in plain JS, plus a page-break overlay + label
const fitScript = `
const el = document.querySelector('.resume'); const pages = Number(el.dataset.pages); const budget = pages * ${pageH} + 2;
function fit() {
  let step = 0, h = 0;
  for (step = 0; step < ${FIT_STEPS.length}; step++) { el.dataset.fit = String(step); h = el.offsetHeight; if (h <= budget) break; }
  if (step === ${FIT_STEPS.length}) step = ${FIT_STEPS.length - 1};
  const used = Math.max(1, Math.ceil((h - 2) / ${pageH}));
  document.getElementById('label').textContent = used + ' of ' + pages + ' pages · fit step ' + step + (h <= budget ? '' : ' · OVER');
  document.querySelectorAll('.brk').forEach((b) => b.remove());
  for (let i = 1; i < used; i++) { const b = document.createElement('div'); b.className = 'brk'; b.style.top = (i * ${pageH}) + 'px'; b.textContent = 'page ' + (i + 1); el.appendChild(b); }
}
fit(); document.fonts.ready.then(fit);`;
for (const template of RESUME_TEMPLATES) {
  for (const pages of pageCounts) {
    const html = renderToStaticMarkup(<ResumeSheet doc={doc} template={template} pageSize="A4" pages={pages} theme={DEFAULT_THEME} />);
    const name = pageCounts.length > 1 || pages !== 2 ? `${template}-${pages}p` : template;
    writeFileSync(
      `${out}/${name}.html`,
      `<!doctype html><html><head><meta charset="utf-8"><title>${template} · ${pages} pages</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;background:#e9e7e2;padding:24px}${css}
#label{font:12px ui-monospace,monospace;color:#444;text-align:center;margin:0 0 10px}
.resume{position:relative}.brk{position:absolute;left:0;right:0;border-top:1px dashed #d85a30;font:9px ui-monospace,monospace;color:#d85a30;text-align:right;padding:2px 8px}</style></head>
<body><p id="label"></p>${html}<script>${fitScript}</script></body></html>`
    );
    console.log("wrote", name);
  }
}
