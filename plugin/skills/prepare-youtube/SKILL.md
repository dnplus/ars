---
name: prepare-youtube
description: Read prepare-youtube context, generate YouTube metadata, and mark the artifact ready before publish.
argument-hint: "<series>/<epId>"
model: claude-sonnet-4-6
effort: medium
---

Run `npx ars prepare youtube <series>/<epId>` from the repo root.

Behavior:
- Treat prepare as the mandatory first stage of the YouTube flow.
- Read `output/publish/<series>/<epId>/prepare-youtube.md` as the source context.
- Read and update `output/publish/<series>/<epId>/prepare-youtube.json`.
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
