---
name: ars:plan
description: Official episode planning entrypoint. Create plan.md under .ars/episodes/<epId>/.
argument-hint: "[topic...]"
model: claude-sonnet-4-6
effort: medium
---

`/ars:plan` is the official entrypoint for planning a new or existing episode. Its job is to **clarify intent with the user and hand off to `ars:planner`** — not to research or draft.

## Division of labor

- **This skill (`/ars:plan`)**: interview the user, confirm direction, parse the argument, resolve epId, scaffold the episode container if missing. Light WebSearch / WebFetch only to help the user narrow the angle. Do NOT compile research findings here.
- **`ars:planner` subagent**: does the substantive research needed to write a credible plan, then synthesizes everything into `plan.md`. This is where citations and reference-gathering live.

Skip both roles and you get a plan built on guesswork. Do one role's job twice and you waste tokens.

## Core flow

1. Read `SERIES_GUIDE.md` at repo root. Use it to pre-answer audience / length range / tone / visual direction / default CTA.
2. Parse the argument (see `references/interview.md`). If too thin, run the minimal interview covering only unanswered dimensions.
3. Resolve the active series from `.ars/config.json` and pick the next epId.
4. If `src/episodes/<active-series>/<epId>.ts` is missing, run `npx ars episode create <epId>`.
5. Hand off to the bundled `ars:planner` agent. Pass gathered context (see `references/interview.md` for the prompt contents). Do not use Claude Code Plan Mode for this handoff; the deliverable is the `plan.md` file itself.
6. After the planner returns, **open Studio on the plan phase and start the intent watch loop** — see `## Studio handoff` below.
7. Track the next workflow steps in your session notes or todo system: `/ars:build`, `/ars:review`, `/ars:audio`, `/ars:prepare-youtube`, `/ars:publish-youtube`.
8. Direct the user to review the rendered plan in Studio and submit ✨ intents on any section that needs adjustment. Next step is `/ars:build <epId>` — the user triggers it from Studio's "觸發 Build" button, or by typing `/ars:build <epId>` in the TUI.

## Studio handoff

The plan is written to disk, but the user reads it in Studio. After the planner returns:

1. Make the episode context explicit:

```bash
npx ars workstate switch <epId> --stage plan
```

2. Before opening or reusing Studio, check whether this Claude session already has a running Studio process and Studio intent Monitor:
   - If Studio is already open for this same `<epId>` and phase, reuse it. Do not start a duplicate Vite server just to get a fresh URL.
   - If Studio is open for this same `<epId>` but no intent Monitor is running, keep the Studio process and start the Monitor immediately.
   - If Studio or the Monitor is for a different episode, stop the old Monitor first, keep the explicit workstate switch above, then open/reuse Studio for this target.
3. Run `npx ars studio <epId> --phase plan` in the background only when there is no reusable Studio process. Tell the user the localhost URL printed in the output and that they can submit feedback on any section directly from the Plan view.
4. Whenever Studio is opened or reused, register an event-driven watch over `.ars/studio-intents/` **using the `Monitor` tool**:

```bash
node -e "
const fs = require('fs');
const dir = '.ars/studio-intents';
fs.mkdirSync(dir, { recursive: true });
fs.watch(dir, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(filename);
  }
});
process.stdout.write('watching\n');
"
```

Each stdout line is a notification. On every notification:

- **Stage guard / stop condition**: continue only when `.ars/state/workstate.json` still points to this `<epId>` and `stage` is `plan` (or `plan:<epId>`). If the user has moved on (`/ars:build` ran, the episode source was generated, workstate points to another episode/stage, or they explicitly said plan is done), stop the Monitor cleanly. Otherwise:
- Run `npx ars studio intent list --pending --json`. For each pending intent:
  - **`feedback.kind === 'build-trigger'`** — delegate to `/ars:apply-review <intent.id>`, which handles the build trigger and marks the intent processed. After it returns, stop the watch — plan phase is complete.
  - **`target.anchorType === 'markdown-section'` or `'plan'`** — this is a plan-section edit request. Read `.ars/episodes/<epId>/plan.md`, apply the change described in `feedback.message` to the anchored section (Studio sends `anchorMeta.title` + `anchorMeta.line`), save the file. Vite HMR re-renders the Plan view automatically. Then `npx ars studio intent clear <intent.id>`.
  - **Other anchor types** — delegate to `/ars:apply-review <intent.id>`.

Rules for plan-section edits:
- Enforce the plan-shape contract on every edit — do not let a correction turn the plan into a script (see `references/plan-shape.md`).
- Preserve the section ordering (`## Topic` → `## Structure` → `## New card` → `## References` → `## Reminders`).
- Keep `## Structure` as a table. If the feedback asks for content that cannot fit in one-sentence cells, push it into a numbered block under the table instead of growing cells into paragraphs.
- If the feedback conflicts with `SERIES_GUIDE.md`, surface the conflict in your reply rather than silently overriding the guide.

The watch loop runs until `/ars:build` fires (via build-trigger intent or the user typing the command) or the user explicitly ends plan. Do not keep it running once the episode source has been generated — at that point the flow is in build / review phase.

## Principles

- `plan.md` is an **agenda the user reviews in 1-3 minutes**, not a script. When delegating, enforce this intent — the planner will over-elaborate otherwise.
- Optimize for a fast first agenda. If the user pasted enough source material, the planner should write the short Studio-reviewable plan directly and leave deeper research gaps in `## Reminders` instead of blocking on exhaustive sourcing.
- Planning is read-only with respect to episode implementation. No `ep.ts` content, no step payloads, no narration.
- Custom cards are encouraged when a built-in cannot express the core visual in one glance. See `references/custom-card-guide.md`.
- If a visual beat wants an `image` but no concrete asset is available yet, record the desired visual clearly in `## Reminders` or the Structure row. A simple generated SVG image asset is an acceptable build-time fallback for abstract scenes, diagrams, symbolic hero visuals, or placeholders that need more shape than plain text.
- Do not create a repo-level `todo.json`. Session todos only.
- If the planner returns a plan that reads like a script (paragraphs, verbatim narration, per-step timings, restated series rules), re-delegate with the specific bloat quoted and the sentence "這份讀起來像腳本不是 agenda，改成方向式摘要".

## References

- `references/interview.md` — interview questions, argument parsing, when to skip, delegation prompt shape.
- `references/plan-shape.md` — the `plan.md` output contract (sections, columns, reviewability budget, never-include list).
- `references/custom-card-guide.md` — when to propose a new card vs. reuse existing.
