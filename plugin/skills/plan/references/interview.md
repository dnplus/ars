# Requirement interview reference

How `/ars:plan` gathers the missing pieces before delegating to `ars:planner`.

## Purpose

This interview is **intent clarification**, not research. The goal is to know what episode the user wants and confirm the direction before handing off. Light WebSearch / WebFetch is fine when it helps the user narrow the angle — but resist the urge to compile full research here. That is the planner's job.

## Pre-answered from SERIES_GUIDE.md

Read `SERIES_GUIDE.md` first. Treat these as answered unless the user says otherwise:

- audience
- episode length range
- default tone
- visual direction
- CTA policy

Announce which fields were pre-answered so the user can override.

## Questions to ask (only the unanswered ones)

1. **Audience** — skip if SERIES_GUIDE.md covers it
2. **Angle / thesis** — always ask; per-episode
3. **Length** — always propose a target based on source-material density, then ask to confirm:
   - thin / single-point → 1-3 min
   - moderate / 2-3 sub-topics → 3-6 min
   - rich source → 6-30 min
   - must sit inside SERIES_GUIDE.md's range
   - never silently default to the short end
4. **Tone** — skip if SERIES_GUIDE.md covers it
5. **CTA** — ask only when this episode needs a special CTA

Common case: ask angle + length, skip the rest.

## When to skip the interview

- argument contains substantive source material (long article, detailed notes, structured Notion page)
- user says "just do your best, no interview"

## Argument parsing

The `/ars:plan` argument is the source material:
- Notion URL → fetch via MCP Notion tool
- other URL → WebFetch
- plain text → use as-is

If no argument, ask: "What's this episode about? You can paste a URL, notes, an article, or just describe the topic."

## epId

Always derived automatically. List `src/episodes/<active-series>/` for the highest existing `ep\d+` and use the next one. Start at `ep001` if empty.

## Light research during interview

Fine:
- quick WebFetch of a URL the user pasted so you understand the raw shape
- one sanity WebSearch to see if the angle the user proposed exists / is stale

Not fine:
- compiling a full reference list
- fact-checking multiple claims
- reading adjacent articles

Anything heavier belongs in the planner's scope. If the source is genuinely thin and the user's angle needs research, note that in the delegation prompt so the planner does the research.

## Optional research handoff

Before the interview, scan `.ars/research/` for files modified in the last 7 days whose slug clearly matches the user's topic (per-topic files are named `<YYYY-MM-DD>-<slug>.md` or `<YYYY-MM-DD>-<epId>-<slug>.md`).

- **If a recent matching file exists**: read its `## Angle landscape` and `## Topic direction suggestions  (suggested, low confidence)` sections. Pass them verbatim — including the `(suggested, low confidence)` tag — into the delegation prompt as a `<research_findings>` block. Tell the planner to build on the angle landscape and treat the suggested direction as a hypothesis to confirm or reject, not a directive.
- **If no matching file exists** and the topic is genuinely complex (single-sentence description doesn't capture it, the user has not paid attention to who else covered the topic): at the end of the interview, **suggest** the user run `/ars:research <topic>` first to get a competitive landscape. Frame it as optional. If they decline or want to push through, hand off to the planner without research findings — the flow continues normally.
- **If no matching file exists** and the topic is well-bounded or the user has clear angle conviction: skip the suggestion. Don't add friction to a confident user.

Do not run `/ars:research` automatically inside the interview — it is a separate skill the user explicitly invokes. Only **read** existing research files here.

## Delegation prompt contents

When delegating to `ars:planner`, pass:
- active series + epId
- topic / source material (include fetched URL content)
- interview answers + which fields came from SERIES_GUIDE.md
- SERIES_GUIDE.md summary
- output of `npx ars card list`
- existing episode state (if revising)
- **Research status**: either "Research not yet done — please research as needed" OR, if you did light research during the interview, paste what you found under `<research_findings>` and tell the planner to build on it rather than repeat it.

Pass `mode: "plan"` so the planner must call `ExitPlanMode` before writing.
