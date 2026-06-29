# Issue: User data ingestion for logr

## Summary
Add a user-facing data ingestion flow that lets portfolio owners import external profile data and automatically create highlights.

## Why
- Enables easier onboarding for users with existing careers and public history
- Makes `logr` more valuable by reducing manual highlight creation
- Aligns with future Phase 4 goals around smart timeline extraction and structured context

## Proposed scope
- Import from LinkedIn or resume/CV
- Accept documents (Markdown, PDF, DOCX) or data exports
- Auto-extract key events, dates, titles, and links into highlights
- Preserve structured content for `llm.txt` and eventual chat/RAG

## Notes
This can be deferred until after Phase 2 multi-user onboarding and before Phase 3 chat, as it is a strong candidate for Phase 4.

## Acceptance criteria
- [ ] Issue documented in repo
- [ ] Backlog item added to `README.md`
- [ ] Future implementation plan can map extracted items into the existing `Highlight` model
