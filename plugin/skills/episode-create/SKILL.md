---
name: episode-create
description: Create a new episode scaffold for a series with npx ars episode create.
argument-hint: "<series>/<epId>"
model: claude-sonnet-4-6
effort: medium
---

Run `npx ars episode create <series>/<epId>` from the repo root.

Behavior:
- Validate that the argument is present and in `<series>/<epId>` form.
- Let the CLI create the episode file, subtitles stub, and public episode directories.
- Report the created files and the next recommended commands after generation.
- Do not hand-author episode files when the CLI can scaffold them.
