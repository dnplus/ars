---
name: ars:build
description: Build episode source from the approved planning artifacts under .ars/episodes/<epId>/.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: high
---

Use `.ars/episodes/<epId>/plan.md` as the implementation contract.

Behavior:
- Read `STYLING.md` at the repo root before doing anything else. Use it to inform narration copy, tone, and visual choices throughout the episode.
- Resolve the active series from repo state. One repo maps to one series, so `/ars:build` should operate on `<epId>` within that active series.
- Require `.ars/episodes/<epId>/plan.md` before editing.
- Apply the approved episode plan strictly. Do not invent new narrative beats, layouts, cards, or motion systems beyond what the plan allows.
- Use Claude Code todos for session task tracking; do not create or update a repo-level `todo.json`.
- If the plan is missing or ambiguous, stop and ask for `/ars:plan` instead of guessing.

## Phase 1 — Build pending custom cards (if any)

Before writing `ep.ts`, check `.ars/episodes/<epId>/card-specs/` for pending briefs.
If briefs exist, build each card inline using the rules below — do NOT ask the user to run `/ars:new-card` separately.

For each `card-specs/<card-name>.md` brief:

1. **Read the brief** to understand the card's purpose and visual intent.
2. **Read series theme**: Check `src/episodes/<series>/series-config.ts` for theme seed / channel name.
3. **Check for reuse**: Run `npx ars card list` first. If an existing card already covers the need, skip creation and update the plan reference.
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
8. **Delete the processed brief** from `card-specs/` after successful creation.

## Phase 2 — Write episode implementation

After all custom cards are built (or if none were needed):

- Write the episode implementation into `src/episodes/<active-series>/<epId>.ts`.
- Keep continuity fields aligned with the plan.

## Completion

- Run `npx ars episode validate <epId>` after writing `ep.ts`. Fix any validation errors before marking build done.
- Report any remaining polish or review follow-up work separately.
- Suggest next step: `/ars:review ep001`
