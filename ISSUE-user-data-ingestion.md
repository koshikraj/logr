# Issue: User data ingestion for logr

## Status

Implemented. The shipped flow supports story text, PDF/DOCX resumes, and guarded URL imports, plus background multi-source onboarding with persisted progress. The implementation maps extracted items into the current `Event` model and feeds the same structured profile context used by `llm.txt` and chat.

## Summary
Add a user-facing data ingestion flow that lets portfolio owners import external profile data and automatically create timeline events.

## Why
- Enables easier onboarding for users with existing careers and public history
- Makes `logr` more valuable by reducing manual highlight creation
- Aligns with future Phase 4 goals around smart timeline extraction and structured context

## Shipped scope

- Import from story text, profile/portfolio URLs, and resume/CV files
- Accept PDF and DOCX documents; LinkedIn profile URLs are available when the optional scraper is configured, with LinkedIn PDF export as the fallback
- Discover and process supported GitHub, RSS, dev.to, YouTube, and personal-site sources during onboarding
- Extract dates, titles, details, tags, icons, links, media, and profile facts into timeline events
- Persist background import jobs so onboarding and the dashboard can reconnect to progress
- Preserve structured content for `llm.txt` and grounded chat

## Implementation notes

- User-supplied URLs are fetched through the SSRF-guarded import client.
- Extracted events are reviewed before insertion in the manual import flow; magical onboarding auto-publishes results while allowing users to exclude events.
- Existing user-entered profile fields win over imported profile facts.
- Import volume, file size, discovered-source depth, and event counts are bounded in the service layer.

## Acceptance criteria

- [x] Issue documented in repo
- [x] User-facing ingestion included in the product documentation and roadmap
- [x] Extracted items map into the `Event` model
- [x] Imported content appears in `llm.txt` and grounds visitor chat
- [x] URL fetching is SSRF-guarded
- [x] Background import progress survives client disconnects through persisted jobs
