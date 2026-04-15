---
name: scene-build
description: Deprecated alias for /ars:build.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: high
---

This skill is deprecated. Prefer `/ars:build <epId>`.

Compatibility behavior:
- Follow the exact same build contract as `/ars:build`.
- Read `.ars/episodes/<epId>/plan.md` and `todo.json` as the canonical inputs.
- Stop on pending `card-spec` todos instead of inventing a workaround.
