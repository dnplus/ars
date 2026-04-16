---
name: ars:prepare-youtube
description: Read prepare-youtube context, generate YouTube metadata, and mark the artifact ready before publish.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: medium
---

Run `npx ars prepare youtube <epId>` from the repo root.

This CLI call creates `output/publish/<activeSeries>/<epId>/prepare-youtube.md` and `prepare-youtube.json` with episode context and empty TODO sections. The skill then fills those TODOs with LLM-generated metadata.

Behavior:
- Treat prepare as the mandatory first stage of the YouTube flow.
- Run `npx ars prepare youtube <epId>` first — this creates the artifact files. If they already exist and are up-to-date, the CLI is idempotent and safe to re-run.
- Read `output/publish/<activeSeries>/<epId>/prepare-youtube.md` as the source context.
- Read and update `output/publish/<activeSeries>/<epId>/prepare-youtube.json`.
- Generate YouTube `title`, `description`, and `tags` grounded in the episode context.
- Fill the three TODO sections in `prepare-youtube.md`.
- Update the JSON artifact:
  - set `status` to `ready`
  - write `youtube.title`
  - write `youtube.description`
  - write `youtube.tags`
- Leave the artifact in a human-review state after generation; do not auto-publish.
- Wait for human confirmation before any publish step.
- Do not auto-run `publish youtube` just because prepare succeeded.
