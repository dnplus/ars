---
name: setup
description: Plugin-first ARS onboarding. Interview the user, then orchestrate setup, init, and theme generation.
model: claude-sonnet-4-6
effort: medium
---

`/ars:setup` is the official first-run entrypoint for ARS.

Do not treat this skill as a thin wrapper around `npx ars setup`. Your job is to gather branding defaults, initialize the repo, and leave it ready for the first episode.

Interview checklist:
- `series id`: short, filesystem-safe, one repo = one series
- `channel / brand name`
- `visual direction`: colors, aesthetic, references, overall atmosphere
- `tone / narration vibe`
- `mascot or VTuber preference`
- `default visual density / layout bias`

Behavior:
1. If `.ars/config.json` is missing, run `npx ars setup`.
2. If the repo has no active series yet, run `npx ars init <series>`.
3. Generate a theme seed with `npx ars theme generate <series> --prompt "<branding summary>"`.
4. Update `.ars/config.json` so `project.activeSeries` and the collected branding defaults are stored in repo state.
5. Update `src/episodes/<series>/series-config.ts` so the generated defaults reflect the interview:
   - `episodeDefaults.channelName`
   - `episodeDefaults.decorationText`
   - any safe theme / VTuber / branding copy changes that should exist before the first episode
6. Do not stop after raw file copies. The repo should be immediately usable for `/ars:plan`.

Output requirements:
- Report the active series.
- Report where branding defaults were written.
- Suggest the next commands:
  - `/ars:plan <epId>`
  - `/ars:build <epId>`
- Mention the Remotion official Claude Code Skills as an optional but recommended install for better Remotion API accuracy: https://www.remotion.dev/docs/ai/claude-code
- If setup finds an existing active series, do not silently reinitialize a second series. Surface the current repo state and continue cautiously.
