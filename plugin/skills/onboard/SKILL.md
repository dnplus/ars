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

## Output contract

Treat `/ars:onboard` like a guided setup flow, not a raw agent log dump.

For every phase:

- start with a short phase intro:
  - where the user is now
  - what this phase is for
  - what artifact or readiness state it will leave behind
- end with a short handoff:
  - what just got completed
  - what the next phase will do
  - what the user should type or choose next

Keep the tone concrete and operational. Prefer:

- `You are now in Phase 1 walkthrough: this is a demo-only pass to understand the workflow. It will not modify your series files.`
- `Once this phase is done, the next step is customize: keep the template, start from scratch, or skip for now.`
- `The goal of verify is to make sure this repo is actually ready for the first real episode.`

Avoid:

- long architecture explanations
- dumping shell output without interpretation
- saying only `done` / `pass` without telling the user what that means

## Re-run detection

**Do this before any workstate write or phase action.**

Read `.ars/config.json` and check `project.onboardedAt`.

- If `onboardedAt` is **not set** → first onboard run, proceed normally from Phase 1
- If `onboardedAt` **is set** → onboard already completed; **skip Phase 1 entirely**, write workstate `onboard-customize`, enter Phase 2 confirmation mode, then continue to Phase 3 normally

## Phase 1 — walkthrough

**Skip this entire phase if re-run detection determined the series is already customized. Go directly to Phase 2 confirmation mode.**

Stage name: `onboard-walkthrough`

1. Write workstate with stage `onboard-walkthrough`
2. Give a 2-3 sentence intro to ARS
3. Open the review studio **in the background** (use `run_in_background: true` on the Bash tool — do NOT wait for it to finish):

```bash
npx ars review open ep-demo --series template
```

4. Immediately after launching, tell the user:
   - they are currently in **Phase 1 walkthrough**
   - this phase is **demo only** and will not modify their files
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

   This will interactively prompt for YouTube publishing, layout, and channel name. TTS now lives in `series-config.ts` under `SERIES_CONFIG.speech`, so customize owns that part.

   If `project.activeSeries` is already set, skip directly to step 3.

3. Ask the user to pick one of three modes:

   - **from template** — keep the demo content (`ep-demo.ts`, series-scoped cards) as reference, run a brand interview to update theme/vtuber/STYLING
   - **from scratch** — delete the demo content, keep a bare series skeleton, run a brand interview to update theme/vtuber/STYLING
   - **skip for now** — do nothing, come back later with `/ars:onboard`

When presenting the three modes, explain the outcome of each one in one sentence:

- `from template` keeps the demo content as working reference, then writes the new series identity on top
- `from scratch` removes the demo episode and cards but keeps a clean series skeleton
- `skip for now` leaves the repo unchanged and lets them come back later

### from template
- run a brand interview — see `references/branding-guide.md` for the full question set (visual identity AND series identity — audience, mission, tone, length, CTA). Do NOT skip the series identity questions; they drive SERIES_GUIDE.md.
- update `series-config.ts` — see `references/series-structure.md` for the full file structure and key fields
- write `SERIES_GUIDE.md` at repo root — use `references/series-guide-template.md` as the template. **Every field must map to an interview answer, an existing config value, or a documented minimal default.** If the user said "reuse defaults" for series identity questions, use the minimal defaults verbatim and announce which defaults were applied. Never infer audience/mission/takeaway from the channel name.
- mention the advanced extension points when relevant:
  - `shell.layout` can stay on built-in `'streaming'` / `'shorts'`, or advanced users can swap in a series custom layout component
  - series-scoped cards under `src/episodes/<series>/cards/` can add new card types or override built-in engine cards by reusing the same `type`
- add optional custom skills if the user wants them

At the end of this path, summarize the concrete outputs:

- what changed in `series-config.ts`
- whether VTuber / theme / fonts were updated
- that `SERIES_GUIDE.md` now exists and will be read by later skills
- that the next step is Phase 3 verify

### from scratch
- delete demo content in `src/episodes/<series>/`:
  - remove `ep-demo.ts`
  - remove `cards/` (series-scoped card overrides, if any)
- keep `series-config.ts` and `episode.template.ts`
- run the same brand interview and write SERIES_GUIDE.md as in "from template"

At the end of this path, explicitly say that the demo content was removed, the series skeleton remains, and the next step is Phase 3 verify.

### skip for now
- skip the interview
- tell the user they can run `/ars:onboard` at any time to come back and customize
- point them to these key files:
  `series-config.ts` (brand + theme)
  `SERIES_GUIDE.md` (series background knowledge, tone, and structure defaults)
  `public/episodes/<series>/shared/vtuber/` (VTuber images)

Frame this as a deferred customize state, not a completed customize state.

## Phase 2 confirmation mode

Use this mode only when re-run detection shows `project.onboardedAt` is already set.

Do NOT offer the three-way choice here — the series already has customizations. Destroying them (especially via "from scratch") would lose user work.

Instead:
- summarize the current customized state (channel name, primary color, layout, VTuber status, etc.)
- ask whether they want to update branding now or leave it as-is
- if they want changes, run the brand interview from `references/branding-guide.md` against the existing files (never delete `ep-demo.ts` / `cards/` in this mode)
- if they do not want changes, continue directly to Phase 3

Make the summary concrete. Mention current artifacts and settings, not generic phrases like `already customized`.

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
5. If all checks pass, run `npx ars workstate clear --onboarded` — this clears the workstate AND stamps `project.onboardedAt` in `.ars/config.json`, which is the SSOT telling the statusline that onboard is complete
6. Output next-step suggestions:
- `/ars:plan <topic>`
- `/ars:build <epId>`

Do not just paste raw doctor output. Reframe it into a readiness summary:

- `Series context`
- `Review Studio`
- `Audio / TTS`
- `YouTube publish`
- `Analytics`

For each failed item, say:

- what is missing
- why it matters
- the immediate next fix

If all checks pass, close with a completion handoff similar to:

- `Onboarding is complete: series context, config, and provider readiness are all in place.`
- `Next step: start from /ars:plan <topic>, or continue an existing idea with /ars:build <epId>.`

## Phase boundaries

Keep the phases separate:
- Phase 1 is demo walkthrough only
- Phase 2 is series creation and branding customization
- Phase 3 is verification only

Bootstrap (TTS, YouTube, layout, channel name) is handled by `npx ars init` — do not re-ask these in onboard.
