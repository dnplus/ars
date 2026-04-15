---
name: scene-plan
description: Generate a read-only scene plan artifact with planner for a target episode.
argument-hint: "<series>/<epId>"
model: claude-opus-4-6
effort: high
---

Use the `planner` agent for this skill.

Behavior:
- Read the target episode context, series conventions, and any relevant review feedback.
- Produce or revise a plan artifact under `.ars/scene-plans/`.
- Keep the plan read-only with respect to episode source content.
- Include continuity rules, tier A requirements, tier B opportunities, and explicit variant decisions so downstream build work is deterministic.
- If the request asks for direct edits, keep those edits out of scope and return a plan artifact instead.
