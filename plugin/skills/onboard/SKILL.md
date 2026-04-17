---
name: ars:onboard
description: Plugin-first ARS onboarding. Interview the user, then orchestrate repo init, theme generation, and branding defaults.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` follows a strict 4-phase onboarding flow.

Write workstate directly to `.ars/state/workstate.json` at each phase transition. Use this JSON shape:

```json
{ "version": 1, "active": true, "stage": "onboard-walkthrough", "updatedAt": "2026-01-01T00:00:00.000Z" }
```

Always update `updatedAt` with the current ISO timestamp.

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

4. Write the collected settings to `.ars/config.json`
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
- run a brand interview covering `channelName`, `brandTag`, theme direction, tone, and a VTuber reminder
- update `series-config.ts`
- write `STYLING.md`
- add optional custom skills if the user wants them

If the user chooses do it later:
- skip the interview
- tell the user: `跑 \`/ars:onboard\` 可以隨時回來客製化`
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
5. If all checks pass, write workstate with stage `idle`
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
