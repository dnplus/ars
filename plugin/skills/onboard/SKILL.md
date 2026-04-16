---
name: ars:onboard
description: Plugin-first ARS onboarding. Interview the user, then orchestrate repo init, theme generation, and branding defaults.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` is the official first-run entrypoint for ARS.

Do not treat this skill as a thin wrapper around `npx ars init`. Your job is to gather branding defaults, initialize the repo, and leave it ready for the first episode.

## Mode detection

Check whether `src/episodes/<series>/series-config.ts` already has content (from `ars init` template copy):

**Fresh repo (no series-config yet):** run full interview mode — ask each field from scratch.

**Already initialized (series-config exists):** run confirmation mode — read the current values and present them as a structured checklist. Do not re-ask from scratch. Instead:
- List every field with its current value
- Flag fields that are still placeholder defaults (e.g. `channelName: 'Your Channel Name'`, `decorationText: 'Template Demo'`) as **← must change**
- For the rest, ask: "ok 保留 / 要改？"
- Accept bulk answers like "1 改成 X，其他 ok"
- Only ask follow-up questions for fields the user wants to change

Fields to confirm:
- `channelName` — 頻道正式名稱
- `decorationText` (brandTag) — 品牌標語 / decoration text
- `theme` — current theme preset name and primary color; show it, ask if they want to change visual direction
- `tone / narration vibe` — not in config, but ask once to inform future build prompts
- `vtuber` — remind user to replace image files at `public/episodes/<series>/shared/vtuber/` if needed; do NOT touch the paths in config
- `TTS provider` — confirm current setting; if minimax, remind about `.env` keys
- `YouTube publishing` — confirm current setting; if enabled, remind about credential files

When the user gives raw material (brand notes, reference links, image direction), summarize the interpretation choices before writing files.

Behavior:
1. If `.ars/config.json` is missing or the repo has no active series yet, run `npx ars init <series>` first, then enter confirmation mode.
2. Generate or update the theme seed with `npx ars theme generate <series> --prompt "<branding summary>"` if the user wants a theme change.
3. Update `src/episodes/<series>/series-config.ts` with confirmed values:
   - `episodeDefaults.channelName`
   - `episodeDefaults.decorationText`
   - **Do NOT modify `vtuber.closedImg` or `vtuber.openImg` paths.**
4. Do not stop after file writes. The repo should be immediately usable for `/ars:plan`.

Output requirements:
- Report the active series.
- Report where branding defaults were written.
- If the user provided reference material, report the key interpretation choices you mapped into config/theme defaults.
- Suggest the next commands:
  - `/ars:plan <topic>`  — 規劃第一集，可貼 URL、筆記、文章片段，或直接描述題材
  - `/ars:build <epId>`
- Mention the Remotion official Claude Code Skills as an optional but recommended install for better Remotion API accuracy: https://www.remotion.dev/docs/ai/claude-code
- If onboarding finds an existing active series, do not silently reinitialize a second series. Surface the current repo state and continue cautiously.

## Environment check

After completing onboarding, always run `npx ars doctor` and surface any `fail` results to the user with their `fixHint`. Common blockers:
- `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` missing → audio generation will fail
- YouTube credential files missing → publish will fail
- Tell the user exactly what to add to `.env` or where to place credential files before they hit these steps.
