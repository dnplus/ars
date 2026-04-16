---
name: plan
description: Official episode planning entrypoint. Create topic.md and plan.md under .ars/episodes/<epId>/.
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
- If no argument is provided, ask the user: "這集要講什麼？可以貼 URL、筆記、文章片段，或直接描述題材都行。"

Behavior:
- Resolve the active series from repo state. One repo maps to one series, so `/ars:plan` should operate on `<epId>` within that active series.
- If `src/episodes/<active-series>/<epId>.ts` does not exist, run `npx ars episode create <epId>` first to scaffold the container.
- Summarize the episode discussion into `.ars/episodes/<epId>/topic.md`.
- Produce or revise `.ars/episodes/<epId>/plan.md` as the canonical episode contract.
- Keep planning read-only with respect to episode content. Do not write the actual step implementation into `ep.ts`.
- Before adding any custom-card requirement, run `npx ars card list` to see all available built-in and series-scoped cards with their agentHints and live examples. Do not manually scan spec.ts files.
- Treat existing series-scoped custom cards as a reusable local library for that series. Prefer reusing or slightly extending them before proposing a new custom card.
- Add `card-specs/<card-name>.md` briefs only when neither built-in cards nor existing series-scoped custom cards are sufficient.
- If a custom card is required, create `.ars/episodes/<epId>/card-specs/<card-name>.md` with the card brief.
- After producing plan.md, use TodoWrite to create session todos for the full pipeline so the user can track progress:
  - `/ars:build <epId>` — 建卡片 + 寫 ep.ts（含所有 card-specs）
  - `/ars:review <epId>` — 審閱畫面
  - `/ars:audio <epId>` — 生成語音
  - `/ars:prepare <epId>` — 準備上架素材
  - `npx ars publish <epId>` — 發布
- Do not create a repo-level `todo.json`.

Required outputs:
- `topic.md`
- `plan.md`

Plan contract:
- `plan.md` should capture audience, thesis, section flow, per-step goals, preferred cards/layouts, continuity rules, banned moves, and dependencies.
- For every special visual beat, `plan.md` should explicitly record whether it uses a built-in card, an existing series-scoped custom card, or a new custom card.

Next-step guidance:
- Always direct the user to `/ars:build <epId>` as the next step.
- If `card-specs/*.md` briefs exist, note that build will handle card creation automatically — do not tell the user to run `/ars:new-card` separately.
