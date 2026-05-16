---
name: ars:episode-check
description: Run a single-episode coherence checklist after Studio review edits and before prepare/publish; diagnose or patch thesis drift, step seams, stale arguments, visual rhythm, and publish readiness.
argument-hint: "<epId> [--apply]"
model: claude-opus-4-6
effort: high
---

`/ars:episode-check` is the single-episode pre-publish checklist.

Run it after a batch of Studio intents has been applied, especially after `/ars:apply-review all`, and before `/ars:prepare-youtube <epId>`. Individual Studio intents are local patches; this skill checks whether the accumulated patches still form one coherent episode.

Default mode is diagnosis-first. Do not edit episode source unless the user passes `--apply` or explicitly asks you to apply the check's patch plan.

## Boundary vs `/ars:reflect`

- `/ars:episode-check` inspects one episode's local coherence: thesis, seams, stale edits, pacing, visual rhythm, and readiness for prepare/publish.
- `/ars:reflect` inspects long-term series patterns across multiple episodes, analytics, competitor evidence, and Studio intent history.
- This skill may read recent `.ars/reflect/*.md` files as warning context, but it must not update `SERIES_GUIDE.md`.
- If you find a repeated pattern that belongs in the guide, note it under `## Follow-up for reflect` instead of patching the guide here.

## Inputs

Read, in order:

1. `SERIES_GUIDE.md`
2. `.ars/episodes/<epId>/plan.md`
3. `src/episodes/<activeSeries>/<epId>.ts`
4. `.ars/studio-intents/*.json` entries for this episode, including processed and pending intents
5. `npx ars episode stats <epId>`
6. Recent `.ars/reflect/*.md` only when useful as warning context

Before editing or validating, read `.ars/state/workstate.json` when it exists. If it is active and points to a different episode, stop and ask for an explicit episode-context switch. Do not infer the target from an IDE-opened file, stale statusline, or unrelated intent.

If pending intents remain for this episode, do not ignore them. Either process them through `/ars:apply-review <intent.id>` first, or mark the episode-check verdict as blocked by pending local feedback.

## Core Principle

Do not polish first. First prove the episode still has one thesis, one arc, and no visible scars from review edits.

The main failure mode is not one bad step. The main failure mode is that many correct local fixes create a globally awkward episode.

Match the user's language and the series language. If the episode, user feedback, and `SERIES_GUIDE.md` are in Traditional Chinese, write the report in Traditional Chinese. Do not switch to English just because the skill instructions are English.

Keep the report short by default. This is a handoff checklist, not an essay. Prefer the top 3-5 findings over exhaustive commentary.

## Method

Start by writing a thesis lock:

```text
This episode is really arguing: ...
```

Then build a step map before proposing edits:

```markdown
| Step | Job in argument | Key claim | Depends on | Hands off to | Risk |
| --- | --- | --- | --- | --- | --- |
```

Use the map to find:

- steps whose job is unclear
- steps that repeat a prior job
- steps that introduce a new thesis
- steps that depend on a claim that was removed
- adjacent steps with missing connective tissue
- visual beats that no longer match the narration after review edits

## Checklist

### Thesis Lock

- Does the opening promise match the final conclusion?
- Does every step advance the thesis, complicate it, prove it, or resolve it?
- Did review edits pull the episode toward a side topic?
- Is the CTA resolving the episode's actual thesis, not a late tangent?

### Patch Accumulation Check

Studio intents are usually local: one subtitle, one card, one step, one user comment. After several intents are applied, second-order problems can appear.

Check for:

- a later patch contradicting an earlier step
- a new explanation making an old explanation redundant
- an inserted step breaking the original transition
- a deleted or rewritten premise still being referenced downstream
- tone shifting because different review rounds rewrote different steps
- the episode becoming longer, slower, or more side-quest-heavy than the approved plan

Do not assume each resolved intent means the whole episode is ready. Resolved intents only prove local fixes were applied.

### Step Seam Check

For each adjacent pair of steps:

- Why does step B follow step A?
- Is the transition stated in narration, visual layout, or both?
- Did a newly inserted step break the original flow?
- Does the viewer know what question the next step answers?

Prefer fixing seams with a small transition rewrite before adding new material.

### Old/New Argument Conflict

Look for:

- old terminology mixed with newer terminology
- stale premises left behind after a review correction
- duplicate explanations from multiple review rounds
- downstream references to removed examples, visuals, or claims
- "not X, actually Y" corrections that never clean up the old X framing

Choose the stronger/current argument explicitly, then delete or rewrite stale remnants.

### AI-Flavor / Generic Drift

Flag:

- abstract polished sentences that do not say anything concrete
- meta phrases about frameworks, applying lenses, or "let us first" when the user's point is more direct
- generic contrast templates where the episode's actual point is sharper
- explanations that sound like a neutral topic overview instead of this episode's argument
- repeated sentence shapes introduced by review rewrites

Fix by grounding claims in the episode's real thesis, example, source, visual evidence, or host stance.

### Visual Job Check

For each card:

- Is this card doing visual work, or just duplicating narration?
- Is a text-heavy card surrounded by richer SVG/image cards and causing density whiplash?
- Does the card need real evidence, a real screenshot, CLI output, or source material instead of a generic diagram?
- Should this beat be deleted, merged, split, reordered, or given a stronger visual?

Do not swap card types for decoration. Swap only when comprehension improves.

### Summary Sync Check

The ending / summary step often becomes stale after review edits. Check it explicitly:

- Does the summary reflect the final thesis after all local patches?
- Did deleted, merged, or rewritten steps leave stale summary bullets?
- Are new key ideas from review patches missing from the ending?
- Is the summary card an actual whole-episode recap, not only the last side point?
- Does the CTA still ask the right question after the episode's center of gravity changed?

If the episode changed materially, assume the summary probably needs a small update unless you can prove it still matches.

### Publish Readiness

- Cover exists and states the viewer-facing promise.
- Ending summarizes the real episode, not a side note introduced late in review.
- No pending intents remain unless explicitly deferred.
- `npx ars episode stats <epId>` roughly matches the plan's target length and density.
- If narration changed after audio/subtitles were generated, mark affected audio as stale instead of pretending the episode is ready.

## Output

Write a durable report to `.ars/episodes/<epId>/episode-check.md`.

Required report shape:

```markdown
# Episode Check: <epId>

## Verdict
Ready / Needs polish / Needs structural rewrite / Blocked

## Thesis
這集真正要說的是：...

## Top Findings
- ...

## Step Map
| Step | Job | Risk | Fix |
| --- | --- | --- | --- |

## Summary Check
- ...

## Minimal Fixes
1. ...

## Follow-up for reflect
- ...
```

Keep the default report under roughly 80 lines. If the episode is ready, keep it much shorter. Do not manufacture issues just to fill every section.

## `--apply` Mode

When the user passes `--apply` or explicitly asks you to apply the check:

1. Apply only the high-confidence items under `Safe to apply now`.
2. Prefer deletion, merge, reorder, and transition rewrites over adding new steps.
3. Preserve the approved topic and plan unless the plan is contradicted by later user review feedback.
4. Do not update `SERIES_GUIDE.md`; defer durable series lessons to `/ars:reflect`.
5. Run `npx ars episode validate <epId>` after editing.
6. Run `npx ars episode stats <epId>` again and compare against the report.
7. If content narration changed and audio exists, list affected steps whose audio/subtitles need regeneration.
8. Update `.ars/episodes/<epId>/episode-check.md` with an `## Applied` section listing changed files and validation.

## Recommended Workflow

1. `/ars:review <epId>`
2. Apply individual feedback through `/ars:apply-review`
3. When a review batch is done, run `/ars:episode-check <epId>`
4. If the check finds safe local fixes, apply them and validate
5. Only then move to `/ars:prepare-youtube <epId>`
