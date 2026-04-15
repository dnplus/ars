---
name: plan
description: Official episode planning entrypoint. Create topic.md, plan.md, and todo.json under .ars/episodes/<epId>/.
argument-hint: "<epId>"
model: claude-opus-4-6
effort: high
---

Use the `planner` agent for this skill.

`/ars:plan` is the official planning entrypoint for a new or existing episode.

Behavior:
- Resolve the active series from repo state. One repo maps to one series, so `/ars:plan` should operate on `<epId>` within that active series.
- If `src/episodes/<active-series>/<epId>.ts` does not exist, run `npx ars episode create <epId>` first to scaffold the container.
- Summarize the episode discussion into `.ars/episodes/<epId>/topic.md`.
- Produce or revise `.ars/episodes/<epId>/plan.md` as the canonical episode contract.
- Produce or revise `.ars/episodes/<epId>/todo.json` with tracked execution state across planning, optional card work, build, and completion.
- Keep planning read-only with respect to episode content. Do not write the actual step implementation into `ep.ts`.
- Add `card-spec` todos only when existing cards are insufficient.
- If a custom card is required, create `.ars/episodes/<epId>/card-specs/<card-name>.md` with the card brief.

Required outputs:
- `topic.md`
- `plan.md`
- `todo.json`

Plan contract:
- `plan.md` should capture audience, thesis, section flow, per-step goals, preferred cards/layouts, continuity rules, banned moves, and dependencies.
- `todo.json` should include `target`, `phase`, and tracked todo items with stable ids, status, dependencies, outputs, and notes.

Next-step guidance:
- If `card-spec` todos exist, direct the user to `/ars:new-card`.
- Otherwise direct the user to `/ars:build <epId>`.
