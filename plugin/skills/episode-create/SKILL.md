---
name: ars:episode-create
description: Create a new episode scaffold for a series with npx ars episode create.
argument-hint: "<epId>"
model: claude-haiku-4-5-20251001
effort: medium
---

Run `npx ars episode create <epId>` from the repo root.

Behavior:
- Assume the repo already has one active series configured by `npx ars init <series>`. `/ars:onboard` customizes that initialized series but does not create it.
- Validate that the argument is present and is an `epId`, not a free-form topic sentence.
- Let the CLI create the episode file, subtitles stub, and public episode directories.
- Report the created files and the next recommended commands after generation.
- Treat this as a low-level scaffold primitive, not the normal planning entrypoint.
- Recommend `/ars:plan <epId>` as the next workflow step.
- Do not hand-author episode files when the CLI can scaffold them.
