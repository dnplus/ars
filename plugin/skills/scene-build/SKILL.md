---
name: scene-build
description: Build episode scenes by applying the approved scene-plan variant without inventing new structure.
argument-hint: "<series>/<epId>"
model: claude-sonnet-4-6
effort: high
---

Use the scene plan in `.ars/scene-plans/` as the contract for implementation.

Behavior:
- Require a target `<series>/<epId>` and load the matching plan artifact before editing.
- Apply the selected plan variant strictly.
- Do not invent new narrative beats, layouts, cards, or motion systems beyond what the plan allows.
- Keep continuity fields aligned with the plan.
- If the plan is missing or ambiguous, stop and ask for a scene plan instead of guessing.
