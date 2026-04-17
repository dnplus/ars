---
name: ars:review
description: Open the ARS review studio for a target episode and automatically apply review intents as they arrive.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: low
---

## Setup

Run `npx ars review open <epId>` in the background (do not block on it).

Tell the user the studio URL printed in the output and that they can submit feedback directly from the review UI.

## Intent watch loop

After opening the studio, start an event-driven watch using the `Monitor` tool:

```bash
node -e "
const fs = require('fs');
const dir = '.ars/review-intents';
fs.watch(dir, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(filename);
  }
});
process.stdout.write('watching\n');
"
```

Each stdout line from Monitor is a notification. On every notification:

1. **Stage guard**: Check that the current stage is still `"review"` (read `.ars/state/workstate.json`). If not, stop — call `TaskStop` to end the monitor.
2. Run `npx ars review intent list --pending --json` to get all pending intents.
3. For each pending intent:
   - Read `src/episodes/<series>/<epId>.ts`
   - If the intent has an attachment, read it together with `feedback.message` to classify: if feedback implies adding a new slide/step ("插這張", "加一頁", "insert"), treat the attachment as the asset — copy it to `public/episodes/<series>/<epId>/` and use an `image` card. If feedback describes a desired style or points out a bug, treat it as reference or evidence instead.
   - Apply the fix described in `intent.feedback.message` to the step matching `intent.target.stepId`
   - Save the file (Vite HMR will reload the studio automatically)
   - Run `npx ars review intent clear <intent.id>` to mark it processed

## Rules

- Always check the stage guard before processing intents on each notification.
- Always use `npx ars review intent list --pending --json` — never curl the vite server directly.
- Run `npx ars review open` in the background so it doesn't block the watch loop.
- Apply fixes conservatively: only change what the feedback message describes, do not restructure unrelated steps.
- If a fix is ambiguous, apply best-effort and surface what you changed so the user can verify in the studio.
- Review is an iterative loop, not a single pass. It commonly spans two rounds:
  1. **Visual round** — user checks visuals before audio is generated. Intents are usually content / layout fixes.
  2. **Audio round** — after `/ars:audio` runs, the studio plays TTS output. Intents at this point are often pronunciation fixes (see `/ars:apply-review` for how those route to `cli/pronunciation_dict.yaml` instead of `ep.ts`).
- Do not push the user to `review close` just because visual intents are cleared. If audio has not been generated yet, suggest `/ars:audio <epId>` and keep the watch loop running so they can come back and submit pronunciation intents against the newly generated audio.
- When the user explicitly says review is done (or there is no audio round needed, e.g. a shorts with pre-approved voice), run `npx ars review close <epId>` to advance the stage, then call `TaskStop` to end the monitor.
