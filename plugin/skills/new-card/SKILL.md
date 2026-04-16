---
name: ars:new-card
description: Generate a new custom card for a series using ARS primitives. Creates a self-contained CardSpec at src/episodes/<series>/cards/.
argument-hint: "<series> <card-name> [description]"
model: claude-sonnet-4-6
effort: medium
---

Generate a new series-scoped card using ARS engine primitives.

Prefer using this only when `/ars:plan` produced a matching `card-spec` todo or a card brief under `.ars/episodes/<epId>/card-specs/`.
Existing series-scoped cards are reusable assets for that series, not throwaway episode-specific files.

## Overview

Cards in ARS are self-contained modules (CardSpec<TData>) consisting of:
- `spec.ts` — exports `cardSpec: CardSpec<TData>` with type, schema, defaults, component, agentHints
- The component uses only ARS primitives: `BaseSlide`, `WindowSlide`, `ScrollSlide`
- Automatically registered via `import.meta.glob` — no manual registry edits needed

Output path: `src/episodes/<series>/cards/<card-name>/`

## Steps

1. **Parse arguments**: Extract `<series>`, `<card-name>`, and optional `<description>` from args.

2. **Read series theme**: Check `src/episodes/<series>/series-config.ts` for theme seed / channel name to inform visual style.

3. **Understand the card purpose**: If no description, first look for a matching brief under `.ars/episodes/*/card-specs/<card-name>.md`. Only ask one focused question if no brief exists.

4. **Check for reuse before scaffolding**:
   - Run `npx ars card list` to see all built-in and series-scoped cards with agentHints and live examples.
   - If an existing series-scoped card already solves the need, tell the user to reuse it instead of generating a redundant sibling card.
   - If an existing card is close, prefer extending it or recommending a small follow-up patch over creating a near-duplicate.

5. **Choose the right primitive**:
   - `BaseSlide` — fullscreen content, no chrome (default choice for most cards)
   - `WindowSlide` — content inside a window frame (mac/terminal/browser/simple)
   - `ScrollSlide` — WindowSlide with auto-scrolling (for long content like logs, code)

6. **Generate the card**:

   Create `src/episodes/<series>/cards/<card-name>/spec.ts`:
   ```ts
   import { z } from "zod";
   import type { CardSpec } from "../../../../engine/cards/types";
   import { <CardName>Component } from "./component";

   export type <CardName>Data = {
     // fields derived from description
   };

   export const cardSpec = {
     type: "<card-name>",
     title: "<Human Label>",
     description: "<one-line description of what this card renders>",
     schema: z.object({ /* matching fields */ }),
     defaults: { /* sensible defaults */ } satisfies Partial<<CardName>Data>,
     component: <CardName>Component,
     agentHints: {
       whenToUse: "<when an agent should pick this card>",
       notForUseCases: "<what this card is NOT for>",
       exampleData: { /* minimal working data object */ },
     },
   } satisfies CardSpec<<CardName>Data>;
   ```

   Create `src/episodes/<series>/cards/<card-name>/component.tsx`:
   ```tsx
   import React from "react";
   import { BaseSlide } from "../../../../engine/primitives/BaseSlide";
   import { useTheme } from "../../../../engine/shared/ThemeContext";
   import type { CardRenderProps } from "../../../../engine/cards/types";
   import type { <CardName>Data } from "./spec";

   export const <CardName>Component: React.FC<CardRenderProps<<CardName>Data>> = ({ data }) => {
     const theme = useTheme();
     // implement using theme.colors tokens only — never hardcoded hex
     return (
       <BaseSlide>
         {/* card content */}
       </BaseSlide>
     );
   };
   ```
   - If the card renders chart labels or legends with SVG `<text>`, avoid fractional text coordinates. Snap label `x` / `y` to integer pixels, especially when using `textAnchor="middle"`, and prefer `textRendering="geometricPrecision"` to reduce shimmer in Remotion renders.

7. **Verify**: Run `./node_modules/.bin/tsc --noEmit` to confirm no type errors. Never use `npx tsc` — it may install a fake `tsc` package instead of TypeScript.

8. **Report**: Tell the user:
   - Files created
   - The `type` string to reference in episode scripts (e.g., `"<card-name>"`)
   - Example usage snippet for a scene step

## Rules

- **Primitives only**: Never import from deleted legacy cards (ThreeSceneCard, SkiaMatrixRain, etc.)
- **Theme tokens only**: All colors from `theme.colors.*` — never hardcoded hex values
- **Zod schema required**: Every CardSpec must have a schema for agent validation
- **agentHints required**: Helps the AI agent know when and how to use this card
- **Series-scoped**: Cards go in `src/episodes/<series>/cards/`, not in the engine
- **No manual registry**: The glob auto-registers — just create the files
- **SVG text stability**: For charts or diagrams with SVG `<text>`, do not leave `x` / `y` on fractional pixels. Snap them to integers to avoid encoded-video shimmer, especially for centered labels and tick legends.
