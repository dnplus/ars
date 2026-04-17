---
name: ars:plan
description: Official episode planning entrypoint. Create plan.md under .ars/episodes/<epId>/.
argument-hint: "[topic...]"
model: claude-opus-4-6
effort: high
---

Delegate planning work to the `ars:planner` subagent (defined in `.claude/agents/planner.md`) **only after the requirement interview is complete**. When invoking the Agent tool, pass `mode: "plan"` so the planner runs in plan mode and must call `ExitPlanMode` before writing any file — this keeps planning review-first by design. Pass it the gathered context as a structured prompt:
- active series
- epId
- topic / source material (including any fetched URL content)
- interview answers (audience, angle, length, tone, CTA) — include which fields came from SERIES_GUIDE.md vs. the user's live answers
- SERIES_GUIDE.md summary (if present)
- available cards (output from `npx ars card list`)
- any external research findings gathered during planning
- existing episode state (if revising)

`/ars:plan` is the official planning entrypoint for a new or existing episode.

Argument parsing:
- The argument (if any) is the episode source material — anything goes: free text, a Notion URL, any other URL, a pasted article, raw notes, or a mix. There is no epId argument.
- If the argument contains a Notion URL, fetch the page via MCP Notion tool.
- If the argument contains any other URL, fetch it with WebFetch.
- If the argument is plain text or pasted content, use it directly as source material.
- If the source material is too thin to support a credible thesis, key claims, or visual direction, do focused research before delegating to the planner. Any researched claims must be cited in `plan.md`.
- epId is always determined automatically: list `src/episodes/<active-series>/` to find the highest existing `ep\d+`, then use the next one (e.g. ep001 exists → use ep002). If no episodes exist, start at ep001.
- If no argument is provided, ask the user: "What's this episode about? You can paste a URL, notes, an article, or just describe the topic."

Requirement interview gate (MANDATORY before scaffolding or delegating to planner):

First, read `SERIES_GUIDE.md` to extract series-level defaults (audience, length, tone, visual direction, CTA policy). Treat anything stated there as answered — do NOT re-ask per episode.

Then, if the argument is too short, vague, or only names a topic without direction (e.g. "做個品牌介紹", "講一下 A", a single URL with no framing, <80 chars of plain text, or no substantive source content), run a **minimal interview** covering only the unanswered dimensions:

1. **Audience** — Who is this episode for? *(skip if SERIES_GUIDE.md has audience section)*
2. **Angle / thesis** — What's the main thrust for THIS episode? (brand story, product features, founder vision, data/case study, tutorial, etc.) *(always ask — angle is per-episode)*
3. **Length** — **Always propose a target length based on source material density, constrained by the series range in SERIES_GUIDE.md, and ask the user to confirm or override.**
   - Estimate from content: thin/single-point material → short end (1–3 min); moderate depth / 2–3 sub-topics → medium (3–6 min); rich source (long article, deep case study, multiple angles, historical context) → long (6–30 min).
   - State the estimate and reasoning to the user, e.g. "素材豐富（歷史類比 + 投資邏輯 + SaaS 末日論），建議做中長片 6–10 分鐘。series 範圍 1–30 分鐘都可以，要這樣嗎？"
   - Never silently default to the short end of the range when the source material would support more — that's the common failure mode.
4. **Tone** — What should the viewer feel? *(skip if SERIES_GUIDE.md has tone section)*
5. **CTA** — What action (if any) should they take at the end? *(skip if SERIES_GUIDE.md already makes the default CTA policy obvious; ask only when this episode needs a special CTA)*

In the common case where SERIES_GUIDE.md exists, you ask **angle** and **length** (with your length estimate as the starting proposal), and only ask **CTA** when the guide does not already imply a clear default. Announce which fields you're treating as pre-answered from SERIES_GUIDE.md so the user can correct them if needed.

Do NOT run `npx ars episode create` or dispatch to the planner agent until you have answers to the unanswered questions (or the user explicitly says "just do your best, no interview").

If the argument already contains substantive source material (long article, detailed notes, Notion page with structure), the interview is optional — skip it unless critical info is missing.

Behavior:
- Read `SERIES_GUIDE.md` at the repo root before doing anything else. Use it to inform tone, narration style, audience, visual direction, and default CTA assumptions throughout the plan.
- Resolve the active series from repo state. One repo maps to one series, so `/ars:plan` should operate on `<epId>` within that active series.
- If `src/episodes/<active-series>/<epId>.ts` does not exist, run `npx ars episode create <epId>` first to scaffold the container.
- Produce or revise `.ars/episodes/<epId>/plan.md` as the canonical episode contract.
- Keep planning read-only with respect to episode content. Do not write the actual step implementation into `ep.ts`.
- Keep the plan review-first. It should help a human approve the episode quickly and give `/ars:build` clear boundaries without pre-writing the final implementation.
- Before adding any custom-card requirement, run `npx ars card list` to see all available built-in and series-scoped cards with their agentHints and live examples. Do not manually scan spec.ts files.
- Treat existing series-scoped custom cards as a reusable local library for that series. Prefer reusing or slightly extending them before proposing a new custom card.
- **Custom cards are encouraged when a built-in cannot express the core visual idea in one glance.** Do not default to generic cards when a purpose-built card would communicate the thesis more directly. See `references/custom-card-guide.md` for the decision rule, differentiation check, and agentHints quality bar.
- Prefer approved card direction over rigid implementation detail. Lock exact `contentType`, `layoutMode`, duration, copy blocks, filenames, or `data` payloads only when the concept genuinely depends on them.
- `plan.md` must use this shape:
  - `## Topic`
  - `## Structure`
  - `## New card`
  - `## References`
  - `## Reminders`
- `## Topic` must include:
  - Audience
  - Thesis
  - CTA
  - Hero visual
  - Source material / research basis
  - Constraints
- `## Structure` must be a table with these columns:
  - `Section | Steps | Goal | Visual | Card Suggestion | Notes`
- Think from `Visual` first. `Card Suggestion` should be derived from the visual direction. If there is a clear visual gap, put it in `## New card` instead of pretending a built-in card is enough.
- `## New card` must be a table with these columns:
  - `Name | Why | Concept`
- In `## New card`:
  - `Name` = proposed custom card name
  - `Why` = why built-in or existing custom cards are insufficient
  - `Concept` = one-glance visual promise, not spec or data shape
- Do not create separate `card-specs/` files.
- End `plan.md` with explicit `## References` and `## Reminders` sections.
- After producing plan.md, use TodoWrite to create session todos for the full pipeline so the user can track progress:
  - `/ars:build <epId>` — build any needed custom cards + write ep.ts
  - `/ars:review <epId>` — review rendered frames
  - `/ars:audio <epId>` — generate TTS audio
  - `/ars:prepare-youtube <epId>` — prepare YouTube metadata and publish artifacts
  - `/ars:publish-youtube <epId>` — publish to YouTube after human confirmation
- Do not create a repo-level `todo.json`.

Required outputs:
- `plan.md` (with `## Topic` section at the top)

Plan rules:
- See `references/custom-card-guide.md` for the custom card decision rule and differentiation check.
- `plan.md` should capture audience, thesis, CTA, hero visual, section flow, visual direction, card suggestion, references, and reminders.
- Do not add a `## Steps` section.
- Do not add a `card-specs/` directory.

Next-step guidance:
- Always direct the user to `/ars:build <epId>` as the next step.
- If `## New card` contains entries, note that build will handle the custom card work automatically — do not tell the user to run `/ars:new-card` separately.
