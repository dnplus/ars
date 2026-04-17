# plan.md Contract

`plan.md` is the canonical episode contract written by `/ars:plan` and consumed by `/ars:build`.

## Required structure

```markdown
# Episode Plan: <epId>

## Topic

- **Audience**: <who this episode is for>
- **Thesis**: <single core claim — what the audience will believe after watching>
- **Key claims**: <2-4 supporting points>
- **Source material**: <URL, notes, or description of input>

## Episode structure

<Section-by-section breakdown. For each section:>
- Section name and goal
- Narration angle / emotional beat
- Which steps it contains

## Steps

<Per-step plan. For each step:>
- Step ID
- contentType and why (prefer visual over text)
- Narration summary (not the full script — just the angle)
- layoutMode
- Any custom card or special visual requirement

## Cards

<List all card types used. For each non-standard card:>
- Built-in: `<type>` — reason
- Series-scoped existing: `<type>` at `src/episodes/<series>/cards/<name>/` — reason
- New custom card required: `<name>` — brief description, visual intent

## card-specs

<If new custom cards are needed, create `.ars/episodes/<epId>/card-specs/<card-name>.md` briefs.>
<List them here with path references.>

## Continuity rules

<Rules that apply across all steps:>
- Tone and narration style
- Recurring visual motifs
- Banned moves (from STYLING.md)

## Banned moves

<Episode-specific things to avoid — from source material, user instructions, or STYLING.md.>
```

## Invariants

- `## Topic` section is required and must come first
- `thesis` must be a single falsifiable claim, not a chapter summary
- Every custom card requirement must be traceable to a section in `## Steps`
- `card-specs/*.md` briefs must exist for every new custom card listed under `## Cards`
- `/ars:build` treats this file as a strict contract — do not leave ambiguous sections

## card-spec brief format

```markdown
# Card Brief: <card-name>

## Purpose
<What this card renders and why a built-in card is insufficient>

## Visual intent
<What the audience should see and feel>

## Data shape
<Key fields the card needs — rough TypeScript-style sketch>

## Example usage in episode
<Which step(s) will use this card and what data they'll pass>
```

## What plan.md is NOT

- Not a full narration script (that goes in `ep.ts`)
- Not a todo list (use Claude Code todos for session tracking)
- Not a repo-level `todo.json`
