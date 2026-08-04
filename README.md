# logr

**A personal portfolio + AI context layer.** Most people have a LinkedIn. Nobody has a structured, machine-readable, queryable version of their story that works with any AI tool. logr fills that gap — an editorial life-log that is beautiful for humans to read and structured for AI to query.

You log your story once. It becomes three things:

- a **timeline** at `logr.it/you` — year-grouped, hover-to-expand, in your choice of 9 palettes × 8 layouts,
- machine-readable **Markdown context** any AI agent can ingest — the real moat, and
- a grounded **AI chat widget** where visitors ask questions answered strictly from your log.

See **[ROADMAP.md](ROADMAP.md)** for what's built and what's next.

## Features

- **Multi-user** — sign in with Google, claim a handle at `/welcome`, edit at `/dashboard` with a live preview.
- **AI import** — paste your story, upload a resume (PDF/DOCX), or point at a URL; AI structures it into timeline events you review and confirm before anything is saved.
- **Grounded chat** — the visitor chat is prompted with the same complete Markdown context as the public routes, streams via OpenRouter, and is rate-limited. Facts-only: if it's not in your log, it says so.
- **Theming** — 9 palettes (incl. dark `ink`) × 8 layouts (`timeline`, `journal`, `magazine`, `terminal`, `feed`, `card`, `centered`, `polaroid`), persisted per profile, previewable live.
- **Pinned events** — pin up to 7 events from the dashboard events tab (pins dialog); they replace the "recent" side rail (and the OG image's rail) and are marked in the Markdown context.
- **Media** — image upload (S3, or local FS in dev), video/tweet embeds, unfurled link cards, dynamic OG image per profile.

Chat, S3, and Google auth are each feature-gated on their env vars and degrade gracefully when unset.

## Routes

| Route | What |
|-------|------|
| `/` | Marketing landing |
| `/[username]` | Public timeline (e.g. `/koshik`) |
| `/[username]/ask` | Dedicated, shareable grounded-chat page |
| `/[username]/llms.txt` | Primary Markdown context; full unless the profile is oversized |
| `/[username]/llms-full.txt` | Complete, unabridged Markdown context |
| `/[username].md` | Clean Markdown counterpart to the public profile |
| `/[username]/llm.txt` | Legacy-compatible complete context URL |
| `/api/[username]/chat` | Streaming grounded chat API |
| `/dashboard` | Owner editor (auth-gated) — profile · events · appearance · import |
| `/welcome` | Onboarding — claim a handle, seed your timeline |
| `/login` | Google sign-in |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Postgres (Supabase) + Prisma 6 · Auth.js (NextAuth v5, Google OAuth) · Vercel AI SDK via OpenRouter · AWS S3 (local FS in dev) · Tailwind v4 + scoped CSS driven by theme tokens · Source Serif 4 + JetBrains Mono · Vercel.

## Running locally

```bash
npm install
cp .env.example .env     # fill in the values below
npx prisma migrate dev   # applies migrations to your Postgres
npm run db:seed          # loads a demo profile + ~18 events
npm run dev              # http://localhost:3000
```

`.env` (see `.env.example` for details):

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres; transaction pooler (`:6543`, `?pgbouncer=true`) for runtime, session (`:5432`) for `prisma migrate`.
- `AUTH_SECRET` + `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google sign-in for `/dashboard` and onboarding.
- `OPENROUTER_API_KEY` — optional; enables the visitor chat + AI import (`OPENROUTER_MODEL` to override the default model).
- `AWS_*` — optional; S3 image storage (falls back to `./public/uploads`).

## Project structure

```
design/                     # design handoff — visual source of truth (not shipped)
prisma/
  schema.prisma             # Profile, User/Account/Session, Event, Media, ChatMessage
  seed.ts                   # demo profile + events
src/
  auth.ts                   # NextAuth (Google + Prisma adapter)
  app/
    page.tsx                    # marketing landing
    [username]/page.tsx         # public timeline (SSR)
    [username]/llms.txt/route.ts # primary machine-readable context
    [username]/opengraph-image.tsx
    dashboard/page.tsx          # owner editor (auth-gated)
    welcome/page.tsx            # onboarding / handle claim
    api/[username]/chat/route.ts# streaming grounded chat
    api/upload/route.ts         # image upload
  components/
    Portfolio.tsx, ChatWidget.tsx, ShareModal.tsx, ...
    admin/                      # dashboard: forms, theme editor, events, import dialogs
    onboarding/, marketing/, ui/
  lib/
    actions.ts                  # all server actions
    chat.ts, narrate.ts, import.ts, llmtxt.ts, profile.ts, theme.ts, storage.ts, ...
```

JSON-shaped fields (`socials`, `theme`, event `link`) are stored as serialized strings so the schema stays portable. Outbound fetches of user-supplied URLs go through the SSRF-guarded client in `lib/import.ts`.

## Domain

Product domain `logr.it`; portfolios at `logr.it/<handle>`. Primary agent context lives at `logr.it/<handle>/llms.txt`, with complete Markdown at `logr.it/<handle>/llms-full.txt` and `logr.it/<handle>.md`.
