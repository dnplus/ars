---
name: review-open
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

1. Run `npx ars review intent list --pending --json` to get pending intents as JSON array.
2. For each pending intent:
   - Read `src/episodes/<series>/<epId>.ts`
   - Apply the fix described in `intent.feedback.message` to the step matching `intent.target.stepId`
   - Save the file (Vite HMR will reload the studio automatically)
   - Run `npx ars review intent clear <intent.id>` to mark it processed
3. Use `ScheduleWakeup` with `delaySeconds: 30` to schedule the next poll.
4. Continue until the user explicitly says to stop or close review.

## Rules

- Always use `npx ars review intent list --pending --json` for polling — never curl the vite server directly.
- Run `npx ars review open` in the background so it doesn't block the polling loop.
- Apply fixes conservatively: only change what the feedback message describes, do not restructure unrelated steps.
- If a fix is ambiguous, apply best-effort and surface what you changed so the user can verify in the studio.
- Do not exit the loop on your own — only stop when the user explicitly says to stop.
