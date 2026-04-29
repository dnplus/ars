---
name: ars:polish
description: Late-stage refinement for an episode without changing tier A structure.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: medium
---

Polish work is constrained refinement, not a rebuild.

Behavior:
- Read `SERIES_GUIDE.md` at the repo root first. Use it to guide copy tightening, tone consistency, and visual cleanup decisions. The series guide overrides any default this SKILL implies — banned phrases, contrast examples, signature openers / sign-offs in the guide are non-negotiable, even during polish.
- If a legacy `STYLING.md` (or `VOICE.md`, `persona.md`) exists at repo root, also read it. Newer series consolidate everything into `SERIES_GUIDE.md`, so these companion files are read-but-not-required.
- Read `.ars/episodes/<epId>/plan.md` and the current episode source.
- Limit changes to tier B steps and tier B notes from the plan.
- Do not modify tier A structure, core narrative ordering, or locked variants.
- Favor safe refinements such as spacing, copy tightening, visual cleanup, or secondary layout adjustments.
- If the requested change affects tier A, redirect to `/ars:build <epId>` or `/ars:plan <epId>` instead.
