---
name: new-card
description: Generate a new custom card for a series using ARS primitives. Creates a self-contained CardSpec at src/episodes/<series>/cards/.
argument-hint: "<series> <card-name> [description]"
model: claude-sonnet-4-6
effort: medium
---

Generate a new series-scoped card using ARS engine primitives.

## Overview

Cards in ARS are self-contained modules (CardSpec<TData>) consisting of:
- `spec.ts` — exports `cardSpec: CardSpec<TData>` with type, schema, defaults, component, agentHints
- The component uses only ARS primitives: `BaseSlide`, `WindowSlide`, `ScrollSlide`
- Automatically registered via `import.meta.glob` — no manual registry edits needed

Output path: `src/episodes/<series>/cards/<card-name>/`

## Steps

1. **Parse arguments**: Extract `<series>`, `<card-name>`, and optional `<description>` from args.

2. **Read series theme**: Check `src/episodes/<series>/series-config.ts` for theme seed / channel name to inform visual style.

3. **Understand the card purpose**: If no description, ask one focused question: "What should this card display?"

4. **Choose the right primitive**:
   - `BaseSlide` — fullscreen content, no chrome (default choice for most cards)
   - `WindowSlide` — content inside a window frame (mac/terminal/browser/simple)
   - `ScrollSlide` — WindowSlide with auto-scrolling (for long content like logs, code)

5. **Generate the card**:

   Create `src/episodes/<series>/cards/<card-name>/spec.ts`:
   ```ts
   import { z } from "zod";
   import type { CardSpec } from "../../../../engine/cards/types";
   import { <CardName>Component } from "./component";

   export type <CardName>Data = {
     // fields derived from description
   };

   export const cardSpec: CardSpec<<CardName>Data> = {
     type: "<series>/<card-name>",
     schema: z.object({ /* matching fields */ }),
     defaults: { /* sensible defaults */ },
     component: <CardName>Component,
     agentHints: {
       description: "<what this card is for>",
       when: "<when to use this card>",
       fields: {
         // field: "description of what value to put here"
       },
     },
   };
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

6. **Verify**: Run `npx tsc --noEmit` to confirm no type errors.

7. **Report**: Tell the user:
   - Files created
   - The `type` string to reference in episode scripts (e.g., `"<series>/<card-name>"`)
   - Example usage snippet for a scene step

## Rules

- **Primitives only**: Never import from deleted legacy cards (ThreeSceneCard, SkiaMatrixRain, etc.)
- **Theme tokens only**: All colors from `theme.colors.*` — never hardcoded hex values
- **Zod schema required**: Every CardSpec must have a schema for agent validation
- **agentHints required**: Helps the AI agent know when and how to use this card
- **Series-scoped**: Cards go in `src/episodes/<series>/cards/`, not in the engine
- **No manual registry**: The glob auto-registers — just create the files
