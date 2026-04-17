---
name: ars:prepare-youtube
description: Generate 3 YouTube metadata candidates (title/description/tags) grounded in episode context, let the user pick one, then mark the artifact ready.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: medium
---

Run `npx ars prepare youtube <epId>` from the repo root.

This CLI call creates `output/publish/<activeSeries>/<epId>/prepare-youtube.md` and `prepare-youtube.json`. The JSON contains `chapters` (timestamps derived from step durations / subtitles) and empty `youtube.candidates[]` + `youtube.selected: null`. The skill then fills candidates, presents them to the user, waits for a pick, and flattens the selection.

## Two-pass flow

This skill runs in two passes. Do not collapse them.

**Pass 1 — generate candidates:**
1. Run `npx ars prepare youtube <epId>` first. It is idempotent.
2. Read `SERIES_GUIDE.md` at repo root to inherit tone, audience, and packaging heuristics.
3. Read `output/publish/<activeSeries>/<epId>/prepare-youtube.md` as source context (contains episode info, steps summary, and chapters).
4. Read `output/publish/<activeSeries>/<epId>/prepare-youtube.json` to see current state.
5. Generate **exactly 3 candidates** (`youtube-1`, `youtube-2`, `youtube-3`). Each candidate must have a genuinely different angle — not three paraphrases of the same take. Good differentiation examples:
   - candidate 1: pain-point entry targeting the widest viewer
   - candidate 2: technical / specific-object hook targeting the engineer subset
   - candidate 3: stance / opinion hook leveraging the host persona from SERIES_GUIDE.md
6. For each candidate:
   - `title` — tight, under 70 chars, front-load the hook
   - `description` — full body grounded in the episode, ending with a blank line then the chapter block (see below)
   - `tags` — 8-15 relevant tags, include the channel tag (e.g. `人蔘TryCatch`)
   - `rationale` — one sentence explaining why this packaging works for this episode
   - `warnings` — array of strings; empty if none (e.g. claim boundaries, clickbait risk)
7. **Chapter block**: every description MUST end with the exact chapter list from `artifact.chapters`. Do NOT recalculate timestamps, do NOT drop chapters, do NOT paraphrase labels. Format:
   ```
   章節：
   00:00 開場
   00:18 Wintel 鎖定飛輪
   ...
   ```
8. Update `prepare-youtube.json`:
   - set `youtube.candidates` to the 3 candidates
   - keep `status: "pending-review"` and `youtube.selected: null`
   - do NOT touch `youtube.title` / `youtube.description` / `youtube.tags` in pass 1
9. Update `prepare-youtube.md` — append (or rewrite) a `## YouTube Candidates` section with all 3 candidates shown as:
   ```
   ### youtube-1
   - Title: ...
   - Tags: tag1, tag2, ...
   - Rationale: ...
   - Warnings: ...

   ```text
   <full description including chapter block>
   ```
   ```
10. Present a concise summary to the user in chat (1 line per candidate: id + title + one-line rationale) and ask them to pick one by id, e.g. "挑哪個？youtube-1 / youtube-2 / youtube-3，或是要我重跑/微調。"

**Pass 2 — apply selection:**
Triggered when the user replies with a candidate id (or "選 1" / "用 2" / similar):
1. Re-read `prepare-youtube.json` to confirm candidates exist.
2. Find the selected candidate in `youtube.candidates[]`.
3. Update the JSON:
   - `status: "ready"`
   - `youtube.selected: "<chosen id>"`
   - `youtube.title`, `youtube.description`, `youtube.tags` = flattened fields from the selected candidate (this is what `publish youtube` reads)
4. Update the markdown: prepend a `## Selected` block near the top showing which candidate is chosen. Keep the full candidates section below for audit.
5. Report to the user: chosen id, final title, and remind them `/ars:publish-youtube <epId>` is next. Do not auto-publish.

## Rules

- Treat prepare as the mandatory first stage of the YouTube flow.
- The CLI command is idempotent and safe to re-run; re-running preserves existing candidates if they are still good, or the skill can regenerate them on explicit user request ("重跑", "換一批").
- If the user edits a candidate by hand (tweaks title/tags in JSON) and says "用這個", treat it as selection — still flatten to title/description/tags and mark ready.
- Never generate chapter timestamps yourself. Only copy from `artifact.chapters`.
- Leave the artifact in human-review state after pass 1; do not auto-publish after pass 2 either.
