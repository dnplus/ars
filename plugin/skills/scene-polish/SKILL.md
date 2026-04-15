---
name: scene-polish
description: Polish only tier B scene work for a target episode without changing tier A structure.
argument-hint: "<series>/<epId>"
model: claude-sonnet-4-6
effort: medium
---

Polish work is constrained refinement, not a rebuild.

Behavior:
- Read the target plan and episode.
- Limit changes to tier B steps and tier B notes from the plan.
- Do not modify tier A structure, core narrative ordering, or locked variants.
- Favor safe refinements such as spacing, copy tightening, or secondary visual adjustments.
- If the requested change affects tier A, redirect to `/ars:scene-build` or `/ars:scene-plan` instead.
