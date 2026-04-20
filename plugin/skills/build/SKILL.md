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

Behavior:
- Read `SERIES_GUIDE.md` at the repo root before doing anything else. Use it to inform narration copy, tone, and visual choices throughout the episode.
- Resolve the active series from repo state. One repo maps to one series, so `/ars:build` should operate on `<epId>` within that active series.
- Require `.ars/episodes/<epId>/plan.md` before editing.
- Apply the approved episode plan strictly. Do not invent new narrative beats, layouts, cards, or motion systems beyond what the plan allows.
- Treat `plan.md` as a narrative + visual intent contract, not as a pre-filled `ep.ts` dump. If the plan gives a primary card direction plus approved alternates, prefer the primary choice and only use an alternate when implementation constraints justify it.
- Use `## References` and `## Reminders` from the plan during implementation so sourced claims, unresolved assets, and cautions do not get lost.
- Use Claude Code todos for session task tracking; do not create or update a repo-level `todo.json`.
- If the plan is missing or ambiguous, stop and ask for `/ars:plan` instead of guessing.

## Workstate transitions

Update `workstate` at each phase boundary so the Studio Build view can reflect progress. The `stage` value must be exactly `<phase>:<epId>` — the Studio `GET /__ars/build-status` endpoint parses it directly.

```bash
npx ars workstate set --stage "building:<epId>"     # when Phase 1 starts
npx ars workstate set --stage "validating:<epId>"   # right before Completion validate
npx ars workstate set --stage "ready-for-review:<epId>"   # after validate passes
# On any irrecoverable failure:
npx ars workstate set --stage "failed:<epId>"
```

## Phase 1 — Build pending custom cards (if any)

Before writing `ep.ts`, read the `## New card` table in `.ars/episodes/<epId>/plan.md`.
If the table contains real entries, build each card inline using the rules below — do NOT ask the user to run `/ars:new-card` separately.

For each new-card row:

1. **Read the row** to understand the card name, why existing cards are insufficient, and the concept it must deliver at a glance.
2. **Read series theme**: Check `src/episodes/<series>/series-config.ts` for theme seed / channel name.
3. **Check for reuse**: Run `npx ars card list` first. If an existing card already covers the need, skip creation and update the plan reference. If creating, verify the differentiation check from `references/custom-card-guide.md`.
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

## Phase 2 — Write episode implementation

After all custom cards are built (or if none were needed):

- Write the episode implementation into `src/episodes/<active-series>/<epId>.ts`.
- Keep continuity fields aligned with the plan.

## Phase 2.5 — Asset backfill (do this before Completion)

The plan lists visual references but rarely downloads them. Before declaring build done, close the supply/demand loop yourself. For each `image` / `thumbnail` card step:

1. **Check the `src` value.** If it already points to a real local file under `public/` and that file exists, skip.
2. **If plan `## References` has a matching URL**, download it to `public/episodes/<series>/<asset-name>.<ext>` using a standard tool (`curl -sSL -o ...`). Update `src` in `ep.ts` to the local path. Prefer local paths over URLs — URLs rot and Remotion render is offline.
3. **If the step is a live product / site / dashboard and no static image suffices**, open Playwright, capture the exact frame you need (login / navigate / wait / screenshot), save to `public/episodes/<series>/<asset-name>.png`, and use that.
4. **If the step needs counter-examples / "bad" references** that plan did not source (common for A-vs-B hero visuals), run a targeted WebSearch image query and pick a usable result. Download it.
5. **Only if none of the above yields an asset** — use a `PLACEHOLDER_<descriptive-name>.<ext>` filename. The `image` card auto-renders a clear placeholder state so Studio preview does not fail.

**Placeholder policy:**

- A `PLACEHOLDER_` src is a **warning, not a success**. If the step is the Hero visual (per `plan.md ## Topic`), it is a **blocker** — do not complete build silently.
- Every PLACEHOLDER must have a `caption` field on the card explaining **what asset is needed**, so review knows what to provide. Example: `caption: "NEEDS: before/after composite — ugly engineer UI vs Claude Design output"`.
- Track all PLACEHOLDER usages for Completion reporting (see below).

## Completion

- Set workstate to `validating:<epId>` before running validate.
- Run `npx ars episode validate <epId>` after writing `ep.ts`. Fix any validation errors before marking build done.
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
