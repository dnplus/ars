---
name: onboard
description: Plugin-first ARS onboarding. Interview the user, then orchestrate repo init, theme generation, and branding defaults.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` is the official first-run entrypoint for ARS.

Do not treat this skill as a thin wrapper around `npx ars init`. Your job is to gather branding defaults, initialize the repo, and leave it ready for the first episode.

Interview format:
- Start by briefly explaining how onboarding will run:
  - `npx ars init <series>` handles repo bootstrap and the single active series
  - the interview then fills branding defaults, theme direction, and safe series config customization
  - concise answers are fine; the user can also paste extra reference material and you should digest it into the resulting config/theme choices
- Use short menu-style questions when the answer space is already constrained:
  - `default visual density / layout bias`
  - `TTS provider`
  - `YouTube publishing`
- Use open-ended questions when creative interpretation matters:
  - `channel / brand name`
  - `visual direction`
  - `tone / narration vibe`
  - `mascot or VTuber preference`
- For branding or visual direction, explicitly invite the user to paste any useful context:
  - channel description
  - brand notes
  - reference links
  - image direction
  - prior scripts
  - audience notes
- When the user gives raw material instead of direct answers, summarize it back into the concrete defaults you plan to write before making file changes.

Interview checklist:
- `series id`: short, filesystem-safe, one repo = one series
- `channel / brand name`
- `visual direction`: colors, aesthetic, references, overall atmosphere
- `tone / narration vibe`
- `mascot or VTuber preference`
- `default visual density / layout bias`
- `TTS provider`: ask if they want MiniMax TTS for audio generation. If yes, remind them to add `MINIMAX_API_KEY` and `MINIMAX_GROUP_ID` to `.env`, and set `tts.provider: "minimax"` in `.ars/config.json`.
- `YouTube publishing`: ask if they plan to publish to YouTube. If yes, remind them to add `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN` to `.env`, and set `publish.youtube.enabled: true` in `.ars/config.json`.

Behavior:
1. If `.ars/config.json` is missing or the repo has no active series yet, run `npx ars init <series>`.
2. Generate a theme seed with `npx ars theme generate <series> --prompt "<branding summary>"`.
3. Update `.ars/config.json` so `project.activeSeries` and the collected branding defaults are stored in repo state.
4. Update `src/episodes/<series>/series-config.ts` so the generated defaults reflect the interview:
   - `episodeDefaults.channelName`
   - `episodeDefaults.decorationText`
   - any safe theme / VTuber / branding copy changes that should exist before the first episode
5. Do not stop after raw file copies. The repo should be immediately usable for `/ars:plan`.

Output requirements:
- Report the active series.
- Report where branding defaults were written.
- If the user provided reference material, report the key interpretation choices you mapped into config/theme defaults.
- Suggest the next commands:
  - `/ars:plan <epId>`
  - `/ars:build <epId>`
- Mention the Remotion official Claude Code Skills as an optional but recommended install for better Remotion API accuracy: https://www.remotion.dev/docs/ai/claude-code
- If onboarding finds an existing active series, do not silently reinitialize a second series. Surface the current repo state and continue cautiously.

## Environment check

After completing onboarding, always run `npx ars doctor` and surface any `fail` results to the user with their `fixHint`. Common blockers:
- `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` missing → audio generation will fail
- YouTube credential files missing → publish will fail
- Tell the user exactly what to add to `.env` or where to place credential files before they hit these steps.
