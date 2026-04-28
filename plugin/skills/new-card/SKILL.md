---
name: ars:new-card
description: Generate a new custom card for the active series using ARS primitives. Creates a self-contained CardSpec at src/episodes/<active-series>/cards/.
argument-hint: "<card-name> [description]"
model: claude-sonnet-4-6
effort: medium
---

Generate a new series-scoped card using ARS engine primitives.

Prefer using this only when the episode plan clearly calls for a new custom card or the user explicitly asks for one.
Existing series-scoped cards are reusable assets for that series, not throwaway episode-specific files.

## Overview

Cards in ARS are self-contained modules (CardSpec<TData>) consisting of:
- `spec.ts` — exports `cardSpec: CardSpec<TData>` with type, schema, defaults, component, agentHints
- The component uses only ARS primitives: `BaseSlide`, `WindowSlide`, `ScrollSlide`
- Automatically registered via `import.meta.glob` — no manual registry edits needed

Output path: `src/episodes/<active-series>/cards/<card-name>/`

References:
- See `references/card-primitives.md` for `BaseSlide`, `WindowSlide`, and `ScrollSlide` props API.

## Steps

1. **Parse arguments**: Extract `<card-name>` and optional `<description>` from args.

2. **Resolve the active series** from `.ars/config.json`. `/ars:new-card` works inside one repo = one series, so do not ask for a series argument unless the repo is not initialized.

3. **Read series theme**: Check `src/episodes/<active-series>/series-config.ts` for theme seed / channel name to inform visual style.

4. **Understand the card purpose**: If no description, first look at the relevant episode `plan.md`, especially the `## New card` section. Only ask one focused question if the concept is still unclear.

5. **Check for reuse before scaffolding**:
   - Run `ars card list` to see all built-in and series-scoped cards with agentHints and live examples.
   - If an existing series-scoped card already solves the need, tell the user to reuse it instead of generating a redundant sibling card.
   - If an existing card is close, prefer extending it or recommending a small follow-up patch over creating a near-duplicate.

6. **Choose the right primitive**:
   - `BaseSlide` — fullscreen content, no chrome (default choice for most cards)
   - `WindowSlide` — content inside a window frame (mac/terminal/browser/simple)
   - `ScrollSlide` — WindowSlide with auto-scrolling (for long content like logs, code)

7. **Generate the card**:

   Create `src/episodes/<active-series>/cards/<card-name>/spec.ts`:
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

   Create `src/episodes/<active-series>/cards/<card-name>/component.tsx`:
   ```tsx
   import React from "react";
   import { BaseSlide, useCardContext } from "../../../../engine/primitives/BaseSlide";
   import type { CardRenderProps } from "../../../../engine/cards/types";
   import type { <CardName>Data } from "./spec";

   // Body runs INSIDE <BaseSlide>, so it can safely call useCardContext() /
   // Remotion hooks like useCurrentFrame(). The outer component must not call
   // these — the BaseSlide context does not exist before <BaseSlide> mounts.
   const Body: React.FC<{ data: <CardName>Data }> = ({ data }) => {
     const { theme } = useCardContext();
     // implement using theme.colors tokens only — never hardcoded hex
     return <div>{/* card content */}</div>;
   };

   export const <CardName>Component: React.FC<CardRenderProps<<CardName>Data>> = ({ data }) => (
     <BaseSlide>
       <Body data={data} />
     </BaseSlide>
   );
   ```
   - **Never** call `useCardContext`, `useTheme`, or Remotion hooks (`useCurrentFrame`, `useVideoConfig`) in the outer `<CardName>Component` that returns `<BaseSlide>`. They only work inside BaseSlide's subtree — put them in the `Body` child. See `references/card-primitives.md` for the Gotcha.
   - If the card renders chart labels or legends with SVG `<text>`, avoid fractional text coordinates. Snap label `x` / `y` to integer pixels, especially when using `textAnchor="middle"`, and prefer `textRendering="geometricPrecision"` to reduce shimmer in Remotion renders.

8. **Verify**: Run `./node_modules/.bin/tsc --noEmit` to confirm no type errors. Never use `npx tsc` — it may install a fake `tsc` package instead of TypeScript.

9. **Report**: Tell the user:
   - Files created
   - The `type` string to reference in episode scripts (e.g., `"<card-name>"`)
   - Example usage snippet for a scene step

## Rules

- **Primitives only**: Never import from deleted legacy cards (ThreeSceneCard, SkiaMatrixRain, etc.)
- **Theme tokens only**: All colors from `theme.colors.*` — never hardcoded hex values
- **Zod schema required**: Every CardSpec must have a schema for agent validation
- **agentHints required**: Helps the AI agent know when and how to use this card
- **Series-scoped**: Cards go in `src/episodes/<active-series>/cards/`, not in the engine
- **No manual registry**: The glob auto-registers — just create the files
- **SVG text stability**: For charts or diagrams with SVG `<text>`, do not leave `x` / `y` on fractional pixels. Snap them to integers to avoid encoded-video shimmer, especially for centered labels and tick legends.
- **Override rule**: A series card with the same `type` as a built-in engine card will **silently replace** it in the registry for that series. Use this to fully swap an engine card's implementation — all episode steps using that `contentType` will automatically use the series version. See `references/card-primitives.md` for the primitive API.
