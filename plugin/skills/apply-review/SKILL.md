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
- Read `SERIES_GUIDE.md` at the repo root before applying any content / narration change. If the intent rewrites narration or card text, the rewrite must obey the series guide's banned phrases, contrast examples, and tone rules. If a legacy `STYLING.md` (or `VOICE.md`, `persona.md`) exists at repo root, also read it. Pure pronunciation fixes and build-trigger intents do not need the guide.
- Resolve the requested intent by id, or choose the latest unprocessed intent when the argument is `latest` or omitted.
- When the argument is `all`, confirm `.ars/studio-intents/_session-end.flag` exists before proceeding. Treat it as the signal that the review pass is closed and the remaining intents should be batch-applied.
- Read exactly one Studio intent from `.ars/studio-intents/` and inspect its `target`, `source`, `feedback`, and optional `attachments`.
- Before editing, read `.ars/state/workstate.json` when it exists. If it is active and contains `episodeId`, that `episodeId` must match the intent's `target.epId`. For cross-episode work, stop and ask for an explicit episode-context switch (usually `npx ars workstate switch <epId> --stage review`) before applying the intent. Do not let an IDE-opened file, unrelated pending intent, or stale statusline silently change the target episode.
- If `attachments.screenshotPath` is present, read it before making changes.

Classify prepare intents first by reading `target.anchorMeta.hash`, then use `feedback.kind`, then `feedback.message`. Do not infer prepare action from the label alone.

- **Prepare action / prepare metadata fix** — `target.anchorMeta.hash` starts with `prepare:` OR `feedback.kind` is `prepare-generate`, `prepare-select`, `prepare-edit`, or legacy `prepare-trigger`. This comes from the Studio Prepare UI. Do NOT treat it as an episode narration/content fix.
  - `feedback.kind === 'prepare-generate'` should normally pair with hash `prepare:youtube:generate`.
  - `feedback.kind === 'prepare-select'` should normally pair with hash `prepare:<candidateId>:select`.
  - `feedback.kind === 'prepare-edit'` should normally pair with hash `prepare:<candidateId>:title`, `prepare:<candidateId>:description`, `prepare:<candidateId>:tags`, or `prepare:<candidateId>:card`.
  - Legacy `feedback.kind === 'prepare-trigger'` is ambiguous. Always route it by `target.anchorMeta.hash`; never assume it means generate or a duplicate button press.
  - If hash is `prepare:youtube:generate`, run `/ars:prepare-youtube <target.epId>` so Claude Code generates the candidates and writes `output/publish/<series>/<epId>/prepare-youtube.json` plus `.md`.
  - If hash is `prepare:<candidateId>:select`, read `output/publish/<series>/<epId>/prepare-youtube.json`, find the candidate, and apply it to the exported `Episode` object's nested `metadata.youtube` in `src/episodes/<series>/<epId>.ts`. The `youtube` object must live inside `metadata` next to `title` / `subtitle`; do not add a top-level `youtube` field and do not only update the prepare artifact. Then update the prepare artifact so `status: "ready"`, `youtube.selected`, and flattened `youtube.title` / `youtube.description` / `youtube.tags` exactly mirror the applied episode metadata. Studio should display the applied ep metadata after HMR, not just the selected candidate.
  - If hash is `prepare:<candidateId>:title`, `prepare:<candidateId>:description`, `prepare:<candidateId>:tags`, or `prepare:<candidateId>:card`, edit the matching candidate in the prepare artifact. If that candidate is already selected/applied, also update the nested `metadata.youtube` object in the episode source to keep the episode source as the source of truth.
  - If a generate intent already has usable candidates, resolve it as already handled with evidence instead of clearing it. If a select intent was submitted, apply or resolve it; never clear it as a duplicate generate action.
  - After metadata changes, run `npx ars episode validate <target.epId>`.
  - Resolve the intent with changed files, before/after excerpts, and validation. Never patch narration steps for prepare intents unless the feedback explicitly says to change the episode content itself.
- For non-prepare intents, classify by reading `feedback.kind`, then `feedback.message`:
- **Build trigger** — `feedback.kind === 'build-trigger'`. This comes from the Studio Build phase "觸發 Build" button, not from a review feedback form. Do NOT try to patch the episode source. Instead:
  1. Confirm `.ars/episodes/<target.epId>/plan.md` exists. If not, tell the user to run `/ars:plan <epId>` first and resolve the intent as a no-op without building.
  2. Invoke `/ars:build <target.epId>`. The build skill handles its own workstate stage transitions; the Studio Build phase reflects `workstate.json`, pending build-trigger intents, and episode source mtime.
  3. After `/ars:build` returns, resolve the intent with a summary and validation evidence. Skip the rest of this classification — build-trigger intents do not route to episode / plan edits.
- **Pronunciation fix** — `feedback.kind === 'other'` (or unspecified) AND message describes a TTS reading error ("XX 念錯"、"讀成了 YY"、"發音不對"、"斷句怪"、specific wrong pinyin). Do NOT edit the episode source. Instead:
  1. Open `cli/pronunciation_dict.yaml`.
  2. Decide the correct reading from the actual narration context. Prioritize Traditional Chinese / Taiwan-context polyphones and common TTS traps first, especially words involving `重`, `長`, `調`, `行`, `著`, `量`, `為`, `得`, `載`, neutral-tone particles, and domain-specific Chinese compounds. Use tone numbers 1-5; 5 = neutral.
  3. Only use English acronym / brand entries when the reported issue is actually English text. For acronyms, decide between letter-by-letter `"GB/G B"` or full word `"GB/Gigabyte"` based on the feedback.
  4. Append a new entry like `- "詞組/(pinyin1)(pinyin2)"` in a sensible Chinese section. Check the file first — the word may already be there with a wrong pinyin; fix it in place instead of duplicating. Keep English entries in the English sections.
  5. Regenerate just the affected step: `npx ars audio generate <epId> --step <stepId>`. Do not regenerate the whole episode.
  6. If the feedback mentions multiple words across several steps, batch the dict edits first, then re-generate each affected step.
  7. Skip `npx ars episode validate` for pronunciation-only fixes — the Episode schema did not change. Verify instead that `public/episodes/<series>/<epId>/audio/<stepId>.mp3` was rewritten (newer mtime).
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

After any fix kind, resolve the intent with durable evidence. Do not delete the intent file.

Resolution requirements:
- Do not use `npx ars studio intent clear <id>` after applying a fix. `clear` is reserved for explicit skips or legacy/manual maintenance.
- Use `npx ars studio intent resolve <id> --summary <text>` so the intent gets both `processedAt` and `resolution`.
- For edits, include `--changed-file <path>` for each touched file, plus a short `--before <text>` and `--after <text>` excerpt that shows the meaningful change. Keep excerpts concise enough for JSON and CLI arguments.
- Include `--validation <text>` with the validation command/result, such as `npx ars episode validate ep030 passed` or `audio regenerated for step-03`.
- If the intent is a no-op, duplicate, or cannot be applied, still use `resolve` with a summary that explains why and any validation or inspection performed.
- Each intent in batch mode needs its own resolution. Do not rely on the chat transcript, tmux history, or a final summary as the only record.

Batch mode:
- `/ars:apply-review all` processes all pending intents in batch.
- Group intents by target episode when practical, patch each affected step, and validate once at the end of the batch for each touched episode.
- `_session-end.flag` is written automatically by the Vite Studio plugin when the Studio window is closed. It is not a manual file. If it is missing, the Studio session has not been formally closed yet — ask the user to close the Studio window first.
