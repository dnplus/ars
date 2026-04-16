---
name: ars:publish-youtube
description: Run the confirmed YouTube publish flow through the publisher agent.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: medium
---

Use the `publisher` agent for this skill.

Behavior:
- Run `npx ars prepare youtube <epId>` if status is not already `ready`; otherwise skip.
- Show a summary (title, privacy, tags) and ask the human to confirm before uploading.
- On confirmation run `npx ars publish youtube <epId> --yes` — the `--yes` flag bypasses
  the CLI's interactive prompt so you never need to pass stdin.
- Append `--dry-run` if the user requests a test run.
- Append `--privacy public|private|unlisted` if specified (default: private).
- Report the publish result and any next steps after the CLI finishes.
