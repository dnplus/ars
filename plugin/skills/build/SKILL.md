---
name: ars:build
description: Build episode source from the approved planning artifacts under .ars/episodes/<epId>/.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: high
---

Use `.ars/episodes/<epId>/plan.md` as the implementation contract.

References:
- See `references/card-primitives.md` for `BaseSlide`, `WindowSlide`, and `ScrollSlide` props API.
- See `references/card-selection.md` for cross-card selection heuristics (mockApp combos, mermaid vs flowchart, common misuses).

Behavior:
- Read `SERIES_GUIDE.md` at the repo root before doing anything else. It is the canonical voice / visual / pacing brief for this series and overrides any default in this SKILL when it specifies something concrete.
- If a legacy `STYLING.md` (or other `*.md` style guide like `VOICE.md` / `persona.md`) exists at repo root, also read it. New series consolidate everything into `SERIES_GUIDE.md`, so these companion files are read-but-not-required.
- Resolve the active series from repo state. One repo maps to one series, so `/ars:build` should operate on `<epId>` within that active series.
- Require `.ars/episodes/<epId>/plan.md` before editing.
- Apply the approved episode plan strictly. Do not invent new narrative beats, layouts, cards, or motion systems beyond what the plan allows.
- Treat `plan.md` as a narrative + visual intent contract, not as a pre-filled `ep.ts` dump. If the plan gives a primary card direction plus approved alternates, prefer the primary choice and only use an alternate when implementation constraints justify it.
- Use `## References` and `## Reminders` from the plan during implementation so sourced claims, unresolved assets, and cautions do not get lost.
- Use Claude Code todos for session task tracking; do not create or update a repo-level `todo.json`.
- If the plan is missing or ambiguous, stop and ask for `/ars:plan` instead of guessing.

## Style precedence

When this SKILL gives a number (step duration, beat budget, card density) and `SERIES_GUIDE.md` (or its companion files) gives a different number, **the series guide always wins**. The defaults in this file exist only for series whose guide is silent on that dimension. Do not "average" the two — pick the series rule.

Apply the same precedence to qualitative rules: banned phrases, card preferences, opening-line rituals, signature sign-offs, contrast examples. If the series guide has them, follow them verbatim; this SKILL provides general scaffolding only.

## Workstate transitions

Update `workstate` at each phase boundary so the Studio Build view can reflect progress. The `stage` value must be exactly `<phase>:<epId>` — the Studio `GET /__ars/build-status` endpoint parses it directly.

```bash
npx ars workstate set --stage "building:<epId>"     # when Phase 1 starts
npx ars workstate set --stage "validating:<epId>"   # right before Completion validate
npx ars workstate set --stage "ready-for-review:<epId>"   # after validate passes
# On any irrecoverable failure:
npx ars workstate set --stage "failed:<epId>"
```

`workstate set` infers the episode context from `<phase>:<epId>`. When switching from one episode to another outside the normal build transition, make the handoff explicit with `npx ars workstate switch <epId> --stage <stage>` before editing, validating, generating audio, reviewing, preparing, or publishing the new episode.

## Phase 1 — Build pending custom cards (if any)

Before writing `ep.ts`, read the `## New card` table in `.ars/episodes/<epId>/plan.md`.
If the table contains real entries, build each card inline using the rules below — do NOT ask the user to run `/ars:new-card` separately.

Before choosing built-in cards for non-new-card steps, also read `references/card-selection.md` for cross-card heuristics. If `SERIES_GUIDE.md` defines its own card preferences (e.g. `mockApp > image > timeline`, `mermaid > flowchart`), the series ordering wins over the defaults in that reference.

If the approved plan names `markdown` but the row's Visual / Goal is really a before-after, prompt-to-result, input-output, relationship mock, or abstract concept diagram, you may refine the implementation to `image` with a generated SVG asset. This is a card-selection refinement, not a narrative change. Keep the beat's meaning identical and update the plan's Card / Notes if the change is material.

For each new-card row:

1. **Read the row** to understand the card name, why existing cards are insufficient, and the concept it must deliver at a glance.
2. **Read series theme**: Check `src/episodes/<series>/series-config.ts` for theme seed / channel name.
3. **Check for reuse**: Run `ars card list` first. If an existing card already covers the need, skip creation and update the plan reference. If creating, verify the differentiation check from `references/custom-card-guide.md`.
4. **Choose the right primitive**:
   - `BaseSlide` — fullscreen content, no chrome (default for most cards)
   - `WindowSlide` — content inside a mac/terminal/browser window frame
   - `ScrollSlide` — WindowSlide with auto-scrolling (logs, code)
5. **Create `src/episodes/<series>/cards/<card-name>/spec.ts`**:
   ```ts
   import { z } from "zod";
   import type { CardSpec } from "../../../../engine/cards/types";
   import { <CardName>Component } from "./component";

   export const cardSpec = {
     type: "<card-name>",
     title: "<Human Label>",
     description: "<one-line description>",
     schema: z.object({ /* fields */ }),
     defaults: { /* sensible defaults */ } satisfies Partial<<CardName>Data>,
     component: <CardName>Component,
     agentHints: {
       whenToUse: "<when to pick this card>",
       notForUseCases: "<what this card is NOT for>",
       exampleData: { /* minimal working data */ },
     },
   } satisfies CardSpec<<CardName>Data>;
   ```
6. **Create `src/episodes/<series>/cards/<card-name>/component.tsx`**:
   - Use only ARS primitives: `BaseSlide`, `WindowSlide`, `ScrollSlide`
   - Use `useTheme()` for all colors — never hardcode hex values
   - Never import from legacy deleted cards
   - If the card uses SVG `<text>` for chart labels, ticks, legends, or axis titles, snap `x` / `y` to integer pixels, especially for centered text, and prefer `textRendering="geometricPrecision"` to avoid shimmer in Remotion output
7. **Run `./node_modules/.bin/tsc --noEmit`** after each card to catch type errors immediately. Never use `npx tsc` — it may install a fake `tsc` package instead of TypeScript.
8. **Update the plan if needed**: If implementation proves an existing card is enough, revise the `## New card` / `Card Suggestion` entries to match reality.

## Phase 2 — Asset prep (do this BEFORE writing narration)

Visual assets shape narration, not the other way around. Resolve every image / thumbnail / browser-screenshot asset the plan implies **before** drafting `ep.ts`, so narration can describe what's actually on screen.

For each visual asset the plan calls for:

1. **Check the plan's `## References`** for a matching URL. If found, download it to `public/episodes/<series>/<asset-name>.<ext>` using `curl -sSL -o ...`. Prefer local paths over URLs — URLs rot and Remotion render is offline.
2. **If the step is a live product / site / dashboard and no static image suffices**, open Playwright, capture the exact frame you need (login / navigate / wait / screenshot), save to `public/episodes/<series>/<asset-name>.png`.
3. **If the step needs counter-examples / "bad" references** that plan did not source (common for A-vs-B hero visuals), run a targeted WebSearch image query and pick a usable result. Download it.
4. **If no external asset exists but the visual is abstract / symbolic / diagram-like**, generate a small SVG image asset under `public/episodes/<series>/<asset-name>.svg` and use the `image` card. Keep it contentful and simple: labels, shapes, arrows, icons, or a branded composition that clarifies the beat. Do not use this to fake real screenshots, people, products, logos, or sourced evidence.
5. **Only if none of the above yields an asset** — reserve a `PLACEHOLDER_<descriptive-name>.<ext>` filename to use later. Mark the step now in your session todos so you remember to set the `caption` field during Phase 3.

Record the resolved asset paths (or placeholder names) so Phase 3 can wire them into `ep.ts` directly.

**Placeholder policy:**

- A `PLACEHOLDER_` src is a **warning, not a success**. If the step is the Hero visual (per `plan.md ## Topic`), it is a **blocker** — do not complete build silently.
- Every PLACEHOLDER must have a `caption` field on the card explaining **what asset is needed**, so review knows what to provide. Example: `caption: "NEEDS: before/after composite — ugly engineer UI vs Claude Design output"`.
- Track all PLACEHOLDER usages for Completion reporting (see below).

## Phase 3 — Write episode implementation

After all custom cards are built (Phase 1) and assets are prepared (Phase 2):

- Write the episode implementation into `src/episodes/<active-series>/<epId>.ts`.
- Wire each image / thumbnail / browser step to the asset path resolved in Phase 2 (or the reserved `PLACEHOLDER_` name with a clear `caption`).
- Write narration that fits the actual visuals — describe what the audience sees, not what you imagined the asset would be.
- Keep continuity fields aligned with the plan.
- Treat `## Structure` rows as review sections, not a one-to-one final step list. Expand each section into as many concrete `ep.ts` steps as needed for a natural video.

### Build density guidance

> **Series rule first.** If `SERIES_GUIDE.md` (or its companion files) defines a step duration cap, beat budget, split rule, or card density, use it. The numbers below are fallbacks **only** for series whose guide is silent on that dimension.

The build should preserve the approved target length and content depth. Do not compress a long plan into one narrated step per Structure row.

- Parse `## Topic` → `Target length`. If it names a concrete target such as `25 分鐘`, use that as a sizing signal for the script.
- Use `SERIES_GUIDE.md` pacing rules for step size when present. As a fallback for normal narrated long-form content, estimate **30-60 seconds per narrated step**, with about **45 seconds** as the default mental model. This is sizing guidance, not a rigid split rule. Short visual punches can be shorter; dense explanations can run longer when the narration stays natural, but split them if multiple ideas are competing inside one step.
- Convert target length to a rough beat budget before writing:
  - 3 min → roughly 4-6 narrated beats
  - 6 min → roughly 8-12 narrated beats
  - 10 min → roughly 13-20 narrated beats
  - 20 min → roughly 27-40 narrated beats
  - 25 min → roughly 33-50 narrated beats
- A Structure row may become 1 step, 2-4 steps, or a short mini-sequence. Do not split mechanically; split when the viewer needs a new visual anchor or the narration changes job. Examples:
  - "技巧1 Git 由來" → file-name chaos → Git as local history → GitHub as shared workspace
  - "技巧3 Session + Diff" → why the sidebar matters → session grouping → diff indicator → what the user reviews
  - "技巧5 Auto-fix 實戰" → intentionally failed CI → Claude reads the log → code fix → retry → pass / merge
- For each expanded step, write real narration. Do not replace content depth with a longer `durationInSeconds`; duration is only a timing placeholder and subtitles/audio will override it later.
- Keep card content lean while narration carries the explanation. Expansion should add beats and examples, not text walls on screen.
- If the plan's target length and Structure feel contradictory (for example `25 分鐘` but only 5 tiny rows and no source depth), call that out and ask whether the target should shrink or the plan should expand.
- Before Completion, run `npx ars episode stats <epId>` and compare declared/estimated duration against the target as a sanity check. If the output is much shorter than the plan implied, mention that explicitly and either expand the script or ask the user whether the shorter cut is intentional. Validation passing only means the file is structurally valid; it does not mean the episode has the intended depth.

## Phase 4 — Voice self-check

Before validate, do a writing pass against `SERIES_GUIDE.md` (and any companion style files). This is a self-review pass, not a CI gate — skip cleanly when the guide doesn't list a given dimension.

1. **Banned phrases / forbidden patterns.** Collect every banned word, AI 套路句, and replacement guidance from the guide. Grep `ep.ts` narration fields for each one. For every hit, rewrite using the guide's replacement direction (or a natural rewrite if none provided).
2. **Wrong-locale words.** If the guide specifies Traditional Chinese (Taiwan), grep for common mainland forms — `視頻`, `質量`, `缺省`, `信息`, `數據庫`, etc. — and convert to Taiwan equivalents.
3. **Tone calibration via contrast examples.** If the guide has ❌ / ✅ contrast pairs (or "Banned" / "Preferred" sections), read them, then re-read 3 random narration steps in your draft and judge whether they sound closer to the ✅ side. If they drift toward ❌, rewrite.
4. **cardContent ≠ narration.** For each step, compare `cardContent` (or `cardTitle`, `summaryPoints`, `tickerText`, etc.) against the same step's narration. If the card text is more than ~50% verbatim narration, rewrite the card into key phrases / numbers / anchors. The card is the visual hook; the narration carries the story.
5. **Common openers / signature sign-off.** If the guide lists common openers, the cover step's narration should use one. If a signature sign-off exists, the closing step must end with it verbatim.

If you make rewrites in this phase, re-read the affected steps once more before moving to Completion.

## Completion

- Set workstate to `validating:<epId>` before running validate.
- Run `npx ars episode validate <epId>` after writing `ep.ts`. Fix any validation errors before marking build done.
- Run `npx ars episode stats <epId>` and apply the Build density guidance above. Use it as a script-depth sanity check, not a mechanical gate.
- **Scan `ep.ts` for any `PLACEHOLDER_` src values.** Collect them into a `placeholders` list for `last-build.json`.
- Write `.ars/episodes/<epId>/last-build.json` with the validation + asset result so Studio Build view and `/ars:review` have machine-readable state:
  ```json
  {
    "ok": true,
    "errorCount": 0,
    "summary": "episode validate passed",
    "finishedAt": "<ISO timestamp>",
    "placeholders": [
      {
        "stepId": "hero-vs",
        "src": "PLACEHOLDER_ugly-vs-claudedesign.png",
        "caption": "NEEDS: before/after composite — ugly engineer UI vs Claude Design output",
        "isHero": true
      }
    ],
    "warnings": ["1 placeholder asset (hero blocker)"]
  }
  ```
  - On validate failure: `"ok": false`, `errorCount` = actual count, `summary` = one-line reason.
  - If `placeholders` is empty, omit the array and `warnings`.
  - Always write the file, even on failure — Studio view relies on it.
- **Workstate transitions must reflect placeholder state**:
  - No placeholders → `ready-for-review:<epId>`
  - Placeholders exist but none are hero → `ready-for-review-with-warnings:<epId>`
  - Any hero placeholder → `blocked:<epId>:assets-missing` and do NOT suggest `/ars:review` as next step; suggest re-running `/ars:plan` to source the hero asset, or ask the user to provide the file directly
  - Validate failed → `failed:<epId>`
- Report any remaining polish or review follow-up work separately, and mention placeholder caption text verbatim so the user knows what to provide.
- Suggest next step based on the placeholder check above.
