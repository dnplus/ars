---
name: scene-fix
description: Deprecated alias for /ars:apply-review.
argument-hint: "[<intent-id>|latest|all]"
model: claude-sonnet-4-6
effort: medium
---

This skill is deprecated. Prefer `/ars:apply-review [<intent-id>|latest|all]`.

Compatibility behavior:
- Follow the exact same review-intent contract as `/ars:apply-review`.
- Read review intent files from `.ars/review-intents/`.
- Patch the targeted episode step and validate the episode after the change.
