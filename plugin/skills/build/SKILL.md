---
name: build
description: Build episode source from the approved planning artifacts under .ars/episodes/<epId>/.
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: high
---

Use `.ars/episodes/<epId>/plan.md` as the implementation contract.

Behavior:
- Resolve the active series from repo state. One repo maps to one series, so `/ars:build` should operate on `<epId>` within that active series.
- Require `.ars/episodes/<epId>/plan.md` before editing.
- Apply the approved episode plan strictly. Do not invent new narrative beats, layouts, cards, or motion systems beyond what the plan allows.
- If `.ars/episodes/<epId>/card-specs/` contains pending briefs, stop and direct the user to `/ars:new-card` first.
- Use Claude Code todos for session task tracking; do not create or update a repo-level `todo.json`.
- Write the episode implementation into `src/episodes/<active-series>/<epId>.ts`.
- Keep continuity fields aligned with the plan.
- If the plan is missing or ambiguous, stop and ask for `/ars:plan <epId>` instead of guessing.

Completion:
- Run `npx ars episode validate <epId>` after writing `ep.ts`. Fix any validation errors before marking build done.
- Report any remaining polish or review follow-up work separately.
