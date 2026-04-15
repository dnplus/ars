---
name: scene-fix
description: Process one review intent, patch the target step, and validate the episode.
argument-hint: "[<intent-id>|latest]"
model: claude-sonnet-4-6
effort: medium
---

Use review intent files in `.ars/review-intents/` as the input contract.

Behavior:
- Resolve the requested intent by id, or choose the latest unprocessed intent when the argument is `latest` or omitted.
- Read exactly one review intent from `.ars/review-intents/` and inspect its `target`, `source`, `feedback`, and optional `attachments`.
- Use `target.series`, `target.epId`, and `target.stepId` to locate the episode source and the single matching step.
- Patch only that one step. Do not rewrite unrelated steps, episode metadata, shared theme files, or other series assets unless the targeted step cannot work without a minimal local fix.
- Use `feedback.kind` and `feedback.message` as the change brief:
  - `visual`: adjust layout, card content, styling fields, imagery, or composition for the step.
  - `content`: adjust wording, factual content, or card copy for the step.
  - `timing`: adjust timing-related fields for the step only.
  - `other`: apply the smallest coherent fix that addresses the message.
- Keep the step schema valid and preserve existing IDs.
- After editing, run `npx ars episode validate <series>/<epId>`.
- If validation fails, fix the targeted step until validation passes or report the blocking reason.
- When the fix is complete, mark the intent processed by writing `processedAt` with an ISO timestamp. Do not delete the intent file.
- If the requested intent id does not exist, or there is no unprocessed intent for `latest`, stop and report that state instead of guessing.
