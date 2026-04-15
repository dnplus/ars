---
name: scene-plan
description: Deprecated alias for /ars:plan.
argument-hint: "<epId>"
model: claude-opus-4-6
effort: high
---

This skill is deprecated. Prefer `/ars:plan <epId>`.

Compatibility behavior:
- Follow the exact same planning contract as `/ars:plan`.
- Create or revise `.ars/episodes/<epId>/topic.md`, `plan.md`, and `todo.json`.
- Auto-scaffold the episode container in the active series when it does not exist yet.
- Do not present `.ars/scene-plans/` as the source of truth anymore.
