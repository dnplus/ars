---
name: ars:onboard
description: Plugin-first ARS onboarding. Interview the user, then orchestrate repo init, theme generation, and branding defaults.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` follows a strict 3-phase onboarding flow.

At each phase transition, advance the workstate stage using:

```bash
npx ars workstate set --stage <stage-name>
```

This ensures the correct schema version and timestamp.

## Re-run detection

Before starting Phase 1, inspect the target `series-config.ts`.

If `series-config.ts` already has non-placeholder values, skip Phase 1, enter Phase 2 confirmation mode, then continue to Phase 3 normally.

Placeholder detection rule:
- If `episodeDefaults.channelName === 'Your Channel Name'`, treat it as placeholder
- If `episodeDefaults.channelName !== 'Your Channel Name'`, treat it as already customized

## Phase 1 — walkthrough

Stage name: `onboard-walkthrough`

1. Write workstate with stage `onboard-walkthrough`
2. Give a 2-3 sentence intro to ARS
3. Open the review studio **in the background** (use `run_in_background: true` on the Bash tool — do NOT wait for it to finish):

```bash
npx ars review open ep-demo --series template
```

4. Immediately after launching, tell the user:
   - Watch the output for the localhost URL (e.g. `http://localhost:5173`) and share it
   - Browse the demo, then say **`next`** to continue to Phase 2, or **`skip`** to skip the walkthrough
   - When they say `next` or `skip`, kill the review server before proceeding:

```bash
pkill -f "ars review open" 2>/dev/null || true
```

## Phase 2 — customize

Stage name: `onboard-customize`

1. Write workstate with stage `onboard-customize`
2. Check `.ars/config.json` for `project.activeSeries`. If **not set**, the user hasn't run `npx ars init` yet — ask for a series name and run:

```bash
npx ars init <series>
```

   This will interactively prompt for TTS provider, YouTube publishing, layout, and channel name. Do NOT ask these again.

   If `project.activeSeries` is already set, skip directly to step 3.

3. Ask: customize branding now or do it later?

If the user chooses customize now:
- run a brand interview — see `references/branding-guide.md` for questions and color derivation rules
- update `series-config.ts` — see `references/series-structure.md` for the full file structure and key fields
- write `STYLING.md` at repo root — use `references/styling-template.md` as the template, fill in values from the interview
- proactively mention that `shell.layout` can be changed to `'shorts'` if they want 9:16 vertical output — most channels stay on `'streaming'` but it's worth flagging
- add optional custom skills if the user wants them

If the user chooses do it later:
- skip the interview
- tell the user they can run `/ars:onboard` at any time to come back and customize
- point them to these key files:
  `series-config.ts` (brand + theme)
  `STYLING.md` (tone + writing rules)
  `public/episodes/<series>/shared/vtuber/` (VTuber images)

## Phase 2 confirmation mode

Use this mode only when re-run detection shows the series already has non-placeholder values.

Do not restart from scratch. Instead:
- summarize the current customized state
- ask whether they want to update branding now or leave it as-is
- if they want changes, perform the Phase 2 customize flow against the existing files
- if they do not want changes, continue directly to Phase 3

## Phase 3 — verify

Stage name: `onboard-verify`

1. Write workstate with stage `onboard-verify`
2. Run:

```bash
npx ars doctor
```

3. Surface every `fail` result together with its `fixHint`
4. Especially flag:
- YouTube enabled but no auth
- MiniMax selected but no API key
5. If all checks pass, run `npx ars workstate clear` to reset stage to idle
6. Output next-step suggestions:
- `/ars:plan <topic>`
- `/ars:build <epId>`

## Phase boundaries

Keep the phases separate:
- Phase 1 is demo walkthrough only
- Phase 2 is series creation and branding customization
- Phase 3 is verification only

Bootstrap (TTS, YouTube, layout, channel name) is handled by `npx ars init` — do not re-ask these in onboard.
