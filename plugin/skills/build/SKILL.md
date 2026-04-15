---
name: build
description: Build episode source from the approved plan artifacts under .ars/episodes/<epId>/.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: high
---

Use `.ars/episodes/<epId>/plan.md` and `todo.json` as the implementation contract.

Behavior:
- Resolve the active series from repo state. One repo maps to one series, so `/ars:build` should operate on `<epId>` within that active series.
- Require `.ars/episodes/<epId>/plan.md` and `.ars/episodes/<epId>/todo.json` before editing.
- Apply the approved episode plan strictly. Do not invent new narrative beats, layouts, cards, or motion systems beyond what the plan allows.
- If `todo.json` contains pending or blocked `card-spec` items, stop and direct the user to `/ars:new-card` first.
- Update `todo.json` status as work progresses.
- Write the episode implementation into `src/episodes/<active-series>/<epId>.ts`.
- Keep continuity fields aligned with the plan.
- If the plan is missing or ambiguous, stop and ask for `/ars:plan <epId>` instead of guessing.

Completion:
- Run `npx ars episode validate <epId>` after writing `ep.ts`. Fix any validation errors before marking build done.
- Mark build-related todo items as done when `ep.ts` reflects the approved plan and validation passes.
- Report any remaining polish or review follow-up work separately.
