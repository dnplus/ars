---
name: ars:apply-review
description: Apply Studio intents back into the episode source and validate the result.
argument-hint: "[<intent-id>|latest|all]"
model: claude-sonnet-4-6
effort: medium
---

Use Studio intent files in `.ars/studio-intents/` as the input contract. Legacy
review intents in `.ars/review-intents/` are migrated automatically on the next
Studio launch — do not read the legacy directory.

Behavior:
- Resolve the requested intent by id, or choose the latest unprocessed intent when the argument is `latest` or omitted.
- When the argument is `all`, confirm `.ars/studio-intents/_session-end.flag` exists before proceeding. Treat it as the signal that the review pass is closed and the remaining intents should be batch-applied.
- Read exactly one Studio intent from `.ars/studio-intents/` and inspect its `target`, `source`, `feedback`, and optional `attachments`.
- If `attachments.screenshotPath` is present, read it before making changes.

Classify the intent first by reading `feedback.message`:

- **Pronunciation fix** — message describes a TTS reading error ("XX 念錯"、"讀成了 YY"、"發音不對"、"斷句怪"、specific wrong pinyin). Do NOT edit the episode source. Instead:
  1. Open `cli/pronunciation_dict.yaml`.
  2. Decide the correct pinyin yourself from the word/context (tone numbers 1-5; 5 = neutral). For English acronyms, decide between letter-by-letter `"GB/G B"` or full word `"GB/Gigabyte"` based on the feedback.
  3. Append a new entry like `- "詞組/(pinyin1)(pinyin2)"` in a sensible section. Check the file first — the word may already be there with a wrong pinyin; fix it in place instead of duplicating.
  4. Regenerate just the affected step: `npx ars audio generate <epId> --step <stepId>`. Do not regenerate the whole episode.
  5. If the feedback mentions multiple words across several steps, batch the dict edits first, then re-generate each affected step.
  6. Skip `npx ars episode validate` for pronunciation-only fixes — the Episode schema did not change. Verify instead that `public/episodes/<series>/<epId>/audio/<stepId>.mp3` was rewritten (newer mtime).
- **Content / visual fix** — everything else (wrong fact, visual glitch, missing slide, layout). Classify the attachment by reading `feedback.message` together with the screenshot:
  - **Asset to place** (use `image` card): feedback says "插這張"、"放這個畫面"、"加一頁"、"insert"、"add a slide" — the screenshot IS the content. Copy it to `public/episodes/<series>/<epId>/` and use an `image` card with `src` pointing to it.
  - **Visual reference**: feedback describes a desired look but the screenshot is just a reference — do not place the screenshot, adjust the step's style/content instead.
  - **Evidence of a bug**: feedback points out something wrong — the screenshot shows the problem, not the solution. Fix the step based on the feedback message.
  - When in doubt and the feedback mentions adding a new step/slide, default to treating the attachment as an asset to place.
  - Use `target.series`, `target.epId`, and `target.stepId` (or `target.anchorId` when `target.anchorType` is `step`) to locate the episode source and the single matching step. For `target.anchorType === 'markdown-section'`, the intent describes a `plan.md` section — apply the change to `.ars/episodes/<epId>/plan.md` instead of `ep.ts`. For `target.anchorType === 'episode'` or `'plan'`, treat the intent as a whole-episode / whole-plan note.
  - Patch only that one step. Do not rewrite unrelated steps, episode metadata, shared theme files, or other series assets unless the targeted step cannot work without a minimal local fix.
  - Use `feedback.kind` and `feedback.message` as the change brief.
  - Keep the step schema valid and preserve existing IDs.
  - After editing, run `npx ars episode validate <epId>`.
  - If validation fails, fix the targeted step until validation passes or report the blocking reason.
  - If the content change also changed narration text, offer to re-run `npx ars audio generate <epId> --step <stepId>` since the audio for that step is now stale.

After any fix kind, mark the intent processed by writing `processedAt` with an ISO timestamp. Do not delete the intent file.

Batch mode:
- `/ars:apply-review all` processes all pending intents in batch.
- Group intents by target episode when practical, patch each affected step, and validate once at the end of the batch for each touched episode.
- `_session-end.flag` is written automatically by the Vite Studio plugin when the Studio window is closed. It is not a manual file. If it is missing, the Studio session has not been formally closed yet — ask the user to close the Studio window first.
