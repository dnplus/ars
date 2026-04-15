---
name: review-open
description: Open the ARS review workflow for a target episode with npx ars review open.
argument-hint: "<series>/<epId>"
model: claude-sonnet-4-6
effort: low
---

Run `npx ars review open <series>/<epId>` from the repo root.

Behavior:
- Use this to open the review surface for the target episode.
- Tell the user that review feedback should become review intents in `.ars/review-intents/`.
- If the review command reports a missing dependency or unsupported repo state, surface that output directly.
- After opening review, remind the user that fixes should go through `/ars:scene-fix`.
