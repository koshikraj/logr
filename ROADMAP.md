# Roadmap

Status reflects what's actually in the repo. Where the implementation diverged from the original plan, the item is marked done with a note on what shipped instead.

## Product priorities — up next

In priority order:

1. **MCP endpoint** ([#58](https://github.com/koshikraj/logr/issues/58)) — a Model Context Protocol server so AI agents can read a user's log and, after authenticating as the owner, update it (add/edit events programmatically). *Shipped so far:* global read-only server at `/mcp` (Streamable HTTP, stateless; six data tools + `logr://profiles/{username}` resource, conformance-tested). *Next:* OAuth 2.1 (in-house PKCE authorization server on Google sign-in) and owner write tools.
2. **Comments** — signed-in users can comment on another profile's events.
3. **Mentions** — tag other logr users on events (groundwork for cross-profile verified collaborations, [#10](https://github.com/koshikraj/logr/issues/10)).
4. **Custom domains** — bring-your-own domain (`koshik.me` → same page) with logr branding removal.

## Phase 1 — Single user, personal portfolio ✅

*Goal: your own portfolio live at `/yourname` on the product domain.*

- [x] Project setup — Next.js (App Router) + TypeScript + Tailwind v4
- [x] Database — Postgres (Supabase) via Prisma, pooled + direct connection URLs
- [x] Data model — Profile + Event + Media (formerly Highlight/Image)
- [x] Timeline UI from `design/` — all layouts, recreated pixel-perfectly
- [x] Theming system — palettes × layouts × accent as CSS variables, persisted per profile
- [x] Profile header — avatar, name, handle, bio, status, location, socials
- [x] Auto-generate Markdown context — primary `llms.txt`, unabridged `llms-full.txt`, clean `[username].md`, and legacy `llm.txt`; absolute media URLs
- [x] Seed with real data + responsive design
- [x] Auth — *shipped as Google OAuth (Auth.js/NextAuth v5 + Prisma adapter), replacing the interim password login*
- [x] Event CRUD — `/dashboard` editor *(the old `/admin` route)* with drag reorder + live preview
- [x] Image upload — S3 when configured, else local FS (dev); up to 8 media per event
- [x] Theme editor — palette/layout/accent, live-previewable, persisted
- [ ] Custom domain support (Vercel) — `koshik.me` → same page

## Phase 2 — Multi user ✅ (mostly)

*Goal: anyone can sign up and create their own portfolio.*

- [x] Auth upgrade — *shipped with Auth.js (Google), not Clerk*
- [x] Handle selection on signup — `/welcome` with live availability check + reserved-word list
- [x] User dashboard — profile, events, theme, per-user at `/dashboard`
- [x] Onboarding — guided flow: handle → story → AI-drafted first events → publish
- [x] Story-to-timeline — paste prose, AI structures it into events
- [x] User data ingestion — resume upload (PDF/DOCX) and URL import (SSRF-guarded)
- [ ] Email — welcome, view-count notifications
- [ ] Analytics — view counts per profile *(visitor chat questions are logged, but no owner UI yet)*
- [x] SEO — per-profile meta tags, dynamic `og:image`, and owner-verified Person JSON-LD
- [x] Index hygiene — thin/test profiles (no bio/status or <2 events) noindexed and dropped from the sitemap until substantial; www → apex 308
- [x] Pinned events — owner pins up to 7 events (events tab → pins dialog); the public "recent" rail + OG image switch to a "pinned" rail; marked `Pinned: yes` in `llm.txt`

## Phase 3 — AI chat interface ✅ (core shipped)

*Goal: visitors can ask questions about any portfolio.*

- [x] Chat widget embedded on each portfolio page
- [x] Chat API — streams via OpenRouter (Vercel AI SDK), default `anthropic/claude-haiku-4.5`
- [x] Grounded answers — system prompt embeds the profile's `llm.txt`; facts-only, no fabrication
- [x] Rate limiting — 12/min/visitor *(in-memory, per instance; swap for Redis in production)*
- [x] Session-based chat logging — both turns stored per `sessionId`, visitor IPs hashed
- [x] Visitor "ask" intro — one-time popover on the ask pill introducing the grounded chat, with live suggestion chips
- [x] Chat warmup + personalized suggestions — profile view pre-warms prompt/provider/DB caches via `GET /api/[username]/chat`, which also generates 2 AI questions from the log *(cached per profile, 10 min, in-memory per instance)*
- [ ] RAG — index events into pgvector for long profiles ([#11](https://github.com/koshikraj/logr/issues/11))
- [ ] Owner analytics UI — "what visitors asked" view in the dashboard
- [x] Dedicated shareable `/[username]/ask` page with profile-grounded follow-up suggestions ([#9](https://github.com/koshikraj/logr/issues/9))

## Phase 4 — Prompt-based auto population ✅ (mostly)

*Goal: paste your story or resume and get a structured timeline instantly.*

- [x] Natural language → timeline extraction
- [x] Resume / portfolio-URL import (PDF, DOCX, LinkedIn-style pages)
- [x] Smart date extraction from natural language (`dateOn` + full-date flag)
- [x] AI tag suggestion per event
- [x] Edit-and-confirm review flow before anything is inserted
- [x] Link enrichment — URLs in the narrative become tweet/video embeds or unfurled link cards
- [x] Magical onboarding — paste sources (GitHub, blog RSS, dev.to, YouTube, own site via agentic crawl, resume/LinkedIn-PDF drop); publish immediately, background parallel parsing (`/api/import` + `ImportJob` tables) auto-inserts events (with emoji icons + link/tweet media) **and drafts bio/about/socials**; depth-1 discovery follows the site's own github/blog/channel links and captures x/linkedin/instagram profiles as socials; `/[handle]` renders live while building; dashboard shows the wait state
- [ ] Image suggestions per event type
- [ ] Iterative refinement via chat ("add my ETHGlobal win from 2023")

## Next

Bigger bets are tracked as issues under the epic [#8 — logr as the identity layer for the agent era](https://github.com/koshikraj/logr/issues/8), including cross-profile verified collaborations ([#10](https://github.com/koshikraj/logr/issues/10)) and pgvector RAG grounding ([#11](https://github.com/koshikraj/logr/issues/11)).
