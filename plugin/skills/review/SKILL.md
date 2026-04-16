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
   - If the intent has an attachment, read it first and decide whether it is evidence, reference, or the actual asset to place. Do not assume every attachment should become an image card.
   - Apply the fix described in `intent.feedback.message` to the step matching `intent.target.stepId`
   - Save the file (Vite HMR will reload the studio automatically)
   - Run `npx ars review intent clear <intent.id>` to mark it processed

## Rules

- Always check the stage guard before processing intents on each notification.
- Always use `npx ars review intent list --pending --json` — never curl the vite server directly.
- Run `npx ars review open` in the background so it doesn't block the watch loop.
- Apply fixes conservatively: only change what the feedback message describes, do not restructure unrelated steps.
- If a fix is ambiguous, apply best-effort and surface what you changed so the user can verify in the studio.
- When the user says review is done, run `npx ars review close <epId>` to advance the stage to `audio`, then call `TaskStop` to end the monitor.
