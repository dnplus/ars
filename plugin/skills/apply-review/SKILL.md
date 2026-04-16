---
name: apply-review
description: Apply review intents back into the episode source and validate the result.
argument-hint: "[<intent-id>|latest|all]"
model: claude-sonnet-4-6
effort: medium
---

Use review intent files in `.ars/review-intents/` as the input contract.

Behavior:
- Resolve the requested intent by id, or choose the latest unprocessed intent when the argument is `latest` or omitted.
- When the argument is `all`, confirm `.ars/review-intents/_session-end.flag` exists before proceeding. Treat it as the signal that the review pass is closed and the remaining intents should be batch-applied.
- Read exactly one review intent from `.ars/review-intents/` and inspect its `target`, `source`, `feedback`, and optional `attachments`.
- If `attachments.screenshotPath` is present, read it before making changes.
- Do not assume an attachment means "convert this step into an image card".
- First decide whether the attachment is:
  - evidence of what is wrong
  - a visual reference for the desired result
  - the actual asset that should be placed into the episode
- Only treat the attachment as the actual episode asset when the feedback clearly implies that intent.
- Use `target.series`, `target.epId`, and `target.stepId` to locate the episode source and the single matching step.
- Patch only that one step. Do not rewrite unrelated steps, episode metadata, shared theme files, or other series assets unless the targeted step cannot work without a minimal local fix.
- Use `feedback.kind` and `feedback.message` as the change brief.
- Keep the step schema valid and preserve existing IDs.
- After editing, run `npx ars episode validate <epId>`.
- If validation fails, fix the targeted step until validation passes or report the blocking reason.
- When the fix is complete, mark the intent processed by writing `processedAt` with an ISO timestamp. Do not delete the intent file.

Batch mode:
- `/ars:apply-review all` processes all pending intents in batch.
- Group intents by target episode when practical, patch each affected step, and validate once at the end of the batch for each touched episode.
- `_session-end.flag` is written automatically by the Vite Studio plugin when the review session window is closed. It is not a manual file. If it is missing, the review session has not been formally closed yet — ask the user to close the Studio window first.
