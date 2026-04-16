---
name: review
description: Open the ARS review studio for a target episode and automatically apply review intents as they arrive.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: low
---

## Setup

Run `npx ars review open <epId>` in the background (do not block on it).

Tell the user the studio URL printed in the output and that they can submit feedback directly from the review UI.

## Intent polling loop

After opening the studio, enter a watch loop using `ScheduleWakeup`:

1. **Stage guard**: Read `.ars/state/workstate.json` (or `.ars/state/sessions/<sessionId>/workstate.json` if it exists). If `stage` is not `"review"`, stop — do not schedule another wake-up.
2. Run `npx ars review intent list --pending --json` to get pending intents as JSON array.
3. For each pending intent:
   - Read `src/episodes/<series>/<epId>.ts`
   - If the intent has an attachment, read it first and decide whether it is evidence, reference, or the actual asset to place. Do not assume every attachment should become an image card.
   - Apply the fix described in `intent.feedback.message` to the step matching `intent.target.stepId`
   - Save the file (Vite HMR will reload the studio automatically)
   - Run `npx ars review intent clear <intent.id>` to mark it processed
4. Use `ScheduleWakeup` with `delaySeconds: 30` to schedule the next poll.

## Rules

- Always check the stage guard (step 1) at the top of every wake-up iteration before doing anything else.
- Always use `npx ars review intent list --pending --json` for polling — never curl the vite server directly.
- Run `npx ars review open` in the background so it doesn't block the polling loop.
- Apply fixes conservatively: only change what the feedback message describes, do not restructure unrelated steps.
- If a fix is ambiguous, apply best-effort and surface what you changed so the user can verify in the studio.
- When the user says review is done, run `npx ars review close <epId>` to advance the stage to `audio`, then stop scheduling wake-ups. The stage guard on any already-queued wake-up will also stop the loop automatically.
