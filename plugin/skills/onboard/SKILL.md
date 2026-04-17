---
name: ars:onboard
description: Plugin-first ARS onboarding. Interview the user, then orchestrate repo init, theme generation, and branding defaults.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` follows a strict 4-phase onboarding flow.

At each phase transition, advance the workstate stage using:

```bash
npx ars workstate set --stage <stage-name>
```

This ensures the correct schema version and timestamp.

## Re-run detection

Before starting Phase 1, inspect the target `series-config.ts`.

If `series-config.ts` already has non-placeholder values, skip Phase 1 and Phase 2, enter Phase 3 confirmation mode, then continue to Phase 4 normally.

Placeholder detection rule:
- If `episodeDefaults.channelName === 'Your Channel Name'`, treat it as placeholder
- If `episodeDefaults.channelName !== 'Your Channel Name'`, treat it as already customized

## Phase 1 — walkthrough

Stage name: `onboard-walkthrough`

1. Write workstate with stage `onboard-walkthrough`
2. Give a 2-3 sentence intro to ARS
3. Open the review studio:

```bash
npx ars review open ep-demo --series template
```

4. Tell the user to browse the demo, then say `next` or `skip` to continue

## Phase 2 — bootstrap

Stage name: `onboard-bootstrap`

1. Write workstate with stage `onboard-bootstrap`
2. Collect:
- series name (channel slug, kebab-case)
- TTS provider (`minimax` / `none`)
- YouTube publishing (`enabled` / `disabled`)
3. If `.ars/config.json` is missing, run:

```bash
npx ars init --skip-series -y
```

4. Write the collected settings using:

```bash
npx ars config set tts.provider <minimax|none>
npx ars config set publish.youtube.enabled <true|false>
```

5. Do NOT copy the template series
6. Do NOT ask about theme, tone, or VTuber here

## Phase 3 — customize

Stage name: `onboard-customize`

1. Write workstate with stage `onboard-customize`
2. Ask: from template or from scratch?
3. If the user chooses from template, run:

```bash
npx ars init <series>
```

4. If the user chooses from scratch, create:
- a minimal `series-config.ts`
- an empty episode directory
5. Ask: customize now or do it later?

If the user chooses customize now:
- run a brand interview — see `references/branding-guide.md` for questions and color derivation rules
- update `series-config.ts` — see `references/series-structure.md` for the full file structure and key fields
- write `STYLING.md` at repo root — use `references/styling-template.md` as the template, fill in values from the interview
- add optional custom skills if the user wants them

If the user chooses do it later:
- skip the interview
- tell the user they can run `/ars:onboard` at any time to come back and customize
- point them to these key files:
  `series-config.ts` (brand + theme)
  `STYLING.md` (tone + writing rules)
  `public/episodes/<series>/shared/vtuber/` (VTuber images)

## Phase 3 confirmation mode

Use this mode only when re-run detection shows the series already has non-placeholder values.

Do not restart from scratch. Instead:
- summarize the current customized state
- ask whether they want to update branding now or leave it as-is
- if they want changes, perform the Phase 3 customize flow against the existing files
- if they do not want changes, continue directly to Phase 4

## Phase 4 — verify

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
- Phase 2 is repo bootstrap plus config only
- Phase 3 is series creation and branding customization
- Phase 4 is verification only

Do not merge the interviews together.
