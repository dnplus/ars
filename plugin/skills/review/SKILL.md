---
name: ars:review
description: Open the ARS Studio review phase for a target episode and automatically apply Studio intents as they arrive.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: low
---

## Setup

Before opening Studio, make the episode context explicit:

```bash
npx ars workstate switch <epId> --stage review
```

Before opening or reusing Studio, check whether this Claude session already has a running Studio process and Studio intent Monitor:

- If Studio is already open for this same `<epId>` and phase, reuse it. Do not start a duplicate Vite server just to get a fresh URL.
- If Studio is open for this same `<epId>` but no intent Monitor is running, keep the Studio process and start the Monitor immediately.
- If Studio or the Monitor is for a different episode, stop the old Monitor first. For cross-episode review, run the explicit workstate switch above before opening/reusing Studio.
- Opening an episode file in the IDE, seeing an unrelated pending intent, or seeing a different episode in the statusline is only a weak signal; never switch review targets from those signals alone.

Run `npx ars studio <epId> --phase review` in the background only when there is no reusable Studio process (do not block on it).

Tell the user the Studio URL printed in the output and that they can submit feedback directly from the review UI.

## Intent watch loop

Whenever Studio is opened or reused, register an event-driven watch over `.ars/studio-intents/` **using the `Monitor` tool** (not `Bash run_in_background` — Monitor is the only thing that converts each stdout line into a notification you receive):

```bash
npx ars studio intent watch
```

Each stdout line is a notification. On every notification:

1. **Stage guard**: Check `.ars/state/workstate.json`. Continue only when it is active, `stage` is `review` (or `review:<epId>`), and `episodeId` matches this review target. If the workstate points at another episode, stop this monitor; that is a normal explicit episode handoff.
2. Run `npx ars studio intent list --pending --json` to get all pending intents.
3. For each pending intent:
   - Ignore intents whose `target.series` / `target.epId` do not match this review target. Report unrelated backlog once, then leave it alone.
   - Delegate to `/ars:apply-review <intent.id>` so the fix uses the shared routing rules for visual/content/pronunciation/build-trigger intents.
   - Confirm the intent now has `processedAt` and a `resolution` by running `npx ars studio intent show <intent.id>` if the apply step did not print the resolved payload.
   - If the intent is still pending, surface the blocker instead of silently continuing.

## Rules

- Always check the stage guard before processing intents on each notification.
- Cross-episode review work must begin with an explicit workstate switch. If the user asks to move from ep030 to ep029, first stop the old monitor, run `npx ars workstate switch ep029 --stage review`, then open/reuse Studio for ep029 and start a new target-bound monitor.
- Always use `npx ars studio intent list --pending --json` — never curl the vite server directly.
- Run `npx ars studio` in the background so it doesn't block the watch loop.
- Register the watch script via the `Monitor` tool, not `Bash run_in_background`. Only `Monitor` turns each stdout line into a notification.
- The watch loop is a `Monitor` lifecycle, not a Bash process. When the stage guard says stop, stop the Monitor cleanly — that is the normal exit path, not a failure. Only treat a Monitor exit as an error if the stage is still `review` when it dies; in that case re-register it.
- `/ars:review` is the public Studio review entrypoint. The CLI alias `ars review ...` still exists for compatibility, but the review surface itself is Studio.
- Apply fixes through `/ars:apply-review` unless you are handling a repo setup bug outside the episode source. That skill owns intent routing, validation, and resolution records.
- Apply fixes conservatively: only change what the feedback message describes, do not restructure unrelated steps.
- If a fix is ambiguous, apply best-effort and surface what you changed so the user can verify in the Studio.
- A processed Studio intent must normally include `resolution`. Plain `npx ars studio intent clear <id>` is only for explicit skips or maintenance, not successful review fixes.
- Review is an iterative loop, not a single pass. It commonly spans two rounds:
  1. **Visual round** — user checks visuals before audio is generated. Intents are usually content / layout fixes.
  2. **Audio round** — after the Studio's full-audio generation button or `/ars:audio <epId>` runs, the Studio plays TTS output while the episode is still in review. Intents at this point are often pronunciation fixes (see `/ars:apply-review` for how those route to `cli/pronunciation_dict.yaml` instead of `ep.ts`).
- Do not push the user to `review close` just because visual intents are cleared. If audio has not been generated yet, suggest the Studio's full-audio generation button or `/ars:audio <epId>` and keep the watch loop running so they can come back and submit pronunciation intents against the generated audio.
- When the user explicitly says review is done (or there is no audio round needed, e.g. a shorts with pre-approved voice), run `npx ars review close <epId>` (this legacy close command still exists for compatibility), tell them the next step is `/ars:prepare-youtube <epId>`, then stop the watch loop.
