---
name: ars:polish
description: Late-stage refinement for an episode without changing tier A structure.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: medium
---

Polish work is constrained refinement, not a rebuild.

Behavior:
- Read `SERIES_GUIDE.md` at the repo root first. Use it to guide copy tightening, tone consistency, and visual cleanup decisions.
- Read `.ars/episodes/<epId>/plan.md` and the current episode source.
- Limit changes to tier B steps and tier B notes from the plan.
- Do not modify tier A structure, core narrative ordering, or locked variants.
- Favor safe refinements such as spacing, copy tightening, visual cleanup, or secondary layout adjustments.
- If the requested change affects tier A, redirect to `/ars:build <epId>` or `/ars:plan <epId>` instead.
