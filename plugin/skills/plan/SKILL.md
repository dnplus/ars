---
name: ars:plan
description: Official episode planning entrypoint. Create plan.md under .ars/episodes/<epId>/.
argument-hint: "[topic...]"
model: claude-opus-4-6
effort: high
---

Delegate planning work to the `ars:planner` subagent (defined in `.claude/agents/planner.md`). Pass it the gathered context as a structured prompt: active series, epId, topic, available cards, and any existing episode state.

`/ars:plan` is the official planning entrypoint for a new or existing episode.

Argument parsing:
- The argument (if any) is the episode source material — anything goes: free text, a Notion URL, any other URL, a pasted article, raw notes, or a mix. There is no epId argument.
- If the argument contains a Notion URL, fetch the page via MCP Notion tool.
- If the argument contains any other URL, fetch it with WebFetch.
- If the argument is plain text or pasted content, use it directly as source material.
- epId is always determined automatically: list `src/episodes/<active-series>/` to find the highest existing `ep\d+`, then use the next one (e.g. ep001 exists → use ep002). If no episodes exist, start at ep001.
- If no argument is provided, ask the user: "What's this episode about? You can paste a URL, notes, an article, or just describe the topic."

Behavior:
- Read `STYLING.md` at the repo root before doing anything else. Use it to inform tone, narration style, audience, and visual direction throughout the plan.
- Resolve the active series from repo state. One repo maps to one series, so `/ars:plan` should operate on `<epId>` within that active series.
- If `src/episodes/<active-series>/<epId>.ts` does not exist, run `npx ars episode create <epId>` first to scaffold the container.
- Produce or revise `.ars/episodes/<epId>/plan.md` as the canonical episode contract. Include a `## Topic` section at the top that summarizes audience, thesis, key claims, and source material.
- Keep planning read-only with respect to episode content. Do not write the actual step implementation into `ep.ts`.
- Before adding any custom-card requirement, run `npx ars card list` to see all available built-in and series-scoped cards with their agentHints and live examples. Do not manually scan spec.ts files.
- Treat existing series-scoped custom cards as a reusable local library for that series. Prefer reusing or slightly extending them before proposing a new custom card.
- **Custom cards are encouraged when a built-in cannot express the core visual idea in one glance.** Do not default to generic cards when a purpose-built card would communicate the thesis more directly. See `references/custom-card-guide.md` for the decision rule, differentiation check, and agentHints quality bar.
- Add `card-specs/<card-name>.md` briefs only when neither built-in cards nor existing series-scoped custom cards are sufficient. Run the differentiation check before writing any brief.
- If a custom card is required, create `.ars/episodes/<epId>/card-specs/<card-name>.md` with the card brief.
- After producing plan.md, use TodoWrite to create session todos for the full pipeline so the user can track progress:
  - `/ars:build <epId>` — build custom cards + write ep.ts (including all card-specs)
  - `/ars:review <epId>` — review rendered frames
  - `/ars:audio <epId>` — generate TTS audio
  - `/ars:prepare <epId>` — prepare publishing assets
  - `npx ars publish <epId>` — publish
- Do not create a repo-level `todo.json`.

Required outputs:
- `plan.md` (with `## Topic` section at the top)

Plan contract:
- See `references/plan-contract.md` for the required `plan.md` structure, invariants, and card-spec brief format.
- See `references/custom-card-guide.md` for the custom card decision rule, differentiation check, and agentHints quality bar.
- `plan.md` should capture audience, thesis, section flow, per-step goals, preferred cards/layouts, continuity rules, banned moves, and dependencies.
- For every special visual beat, `plan.md` should explicitly record whether it uses a built-in card, an existing series-scoped custom card, or a new custom card.

Next-step guidance:
- Always direct the user to `/ars:build <epId>` as the next step.
- If `card-specs/*.md` briefs exist, note that build will handle card creation automatically — do not tell the user to run `/ars:new-card` separately.
