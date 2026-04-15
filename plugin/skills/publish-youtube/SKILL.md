---
name: publish-youtube
description: Run the confirmed YouTube publish flow through the publisher agent.
argument-hint: "<series>/<epId>"
model: claude-sonnet-4-6
effort: medium
---

Use the `publisher` agent for this skill.

Behavior:
- Confirm that `npx ars prepare youtube <series>/<epId>` has already been reviewed.
- Require explicit human confirmation before upload.
- Wrap the CLI publish flow rather than editing metadata manually.
- If the user asks for a dry run, keep the flow in `--dry-run`.
- Report the publish result and any next steps after the CLI finishes.
