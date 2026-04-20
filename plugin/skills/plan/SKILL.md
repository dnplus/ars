---
name: ars:plan
description: Official episode planning entrypoint. Create plan.md under .ars/episodes/<epId>/.
argument-hint: "[topic...]"
model: claude-opus-4-6
effort: high
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
5. Delegate to `ars:planner` via the Agent tool with `mode: "plan"`. Pass gathered context (see `references/interview.md` for the prompt contents).
6. After the planner returns, use TodoWrite to add session todos: `/ars:build`, `/ars:review`, `/ars:audio`, `/ars:prepare-youtube`, `/ars:publish-youtube`.
7. Direct the user to `/ars:build <epId>` as the next step.

## Principles

- `plan.md` is an **agenda the user reviews in 1-3 minutes**, not a script. When delegating, enforce this intent — the planner will over-elaborate otherwise.
- Planning is read-only with respect to episode implementation. No `ep.ts` content, no step payloads, no narration.
- Custom cards are encouraged when a built-in cannot express the core visual in one glance. See `references/custom-card-guide.md`.
- Do not create a repo-level `todo.json`. Session todos only.
- If the planner returns a plan that reads like a script (paragraphs, verbatim narration, per-step timings, restated series rules), re-delegate with the specific bloat quoted and the sentence "這份讀起來像腳本不是 agenda，改成方向式摘要".

## References

- `references/interview.md` — interview questions, argument parsing, when to skip, delegation prompt shape.
- `references/plan-shape.md` — the `plan.md` output contract (sections, columns, reviewability budget, never-include list).
- `references/custom-card-guide.md` — when to propose a new card vs. reuse existing.
