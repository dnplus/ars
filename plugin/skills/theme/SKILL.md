---
name: ars:theme
description: Generate or tweak the visual theme for a series. Produces a complete Theme from a short style description.
argument-hint: "<series> [description]"
model: claude-sonnet-4-6
effort: medium
---

Generate or adjust the visual theme for an ARS series.

## When called with a series + description
1. Parse the series name and style description from args.
2. Map the description to a ThemeSeed:
   - mode: dark (default) or light
   - primary: pick a hex based on color mentions or mood
   - accent: complementary color (or omit for auto-derive)
   - surfaceTone: 'warm' (gold/earthy), 'cool' (blue/tech), 'neutral' (default)
   - contrast: 'high' (bold), 'medium' (default), 'soft' (gentle)
3. Run: `npx ars theme generate <series> --prompt "<description>"`
4. Tell user: "Theme generated. Open Remotion Studio and check theme-preview/<series> to preview."
5. Ask: "Want to tweak anything? Describe the adjustment."

## When called for tweaks
1. Run: `npx ars theme tweak <series> --instruction "<adjustment>"`
2. Show the changed fields.
3. Offer another round of tweaks or confirm done.

## Rules
- Never hand-write hex codes for the user — always go through the CLI derive pipeline
- If user mentions a brand/company, map its primary brand color to primary seed field
- Always confirm the series name exists under `src/episodes/` before running
