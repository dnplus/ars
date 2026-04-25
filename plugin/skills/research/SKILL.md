---
name: ars:research
description: Scan YouTube competitors for a topic (or recent series topics), cluster angles, and propose differentiated direction. Output feeds /ars:plan and /ars:reflect.
argument-hint: "[topic...] | --series [--days N] [--top N] [--epId X] [--fresh]"
model: claude-opus-4-6
effort: high
---

`/ars:research` is the **market evidence** generator for a series. Use it before `/ars:plan` to see what other channels have done on the same topic, and run `--series` periodically to feed `/ars:reflect` with competitive landscape signal.

## Division of labor

- **This skill (`/ars:research`)**: parse the argument, decide mode (per-topic vs series), resolve active series, run `npx ars research search` / `list-recent-topics` to pull structured competitor data, hand off to `ars:researcher` agent. Do NOT cluster angles or write the output yourself.
- **`ars:researcher` subagent**: does the iterative angle clustering, second-pass enrichment via WebFetch / Playwright, and writes the output file under `.ars/research/`.

Skip both roles and the output is a search-result dump. Do one role's job twice and you waste tokens.

## Modes

### Per-topic — default

```
/ars:research <topic>
/ars:research <topic> --epId <epXXX>     # link the file to an upcoming episode
```

For when the user is about to plan a specific episode and wants to see the competitive landscape first.

### Series-level

```
/ars:research --series                   # scan recent topics, default 5 episodes
/ars:research --series --days N          # widen the scan window (defaults to recent-5)
```

For when the user wants market context before `/ars:reflect`. Aggregates angle clusters across the last 3-5 episode topics to spot whether the series keeps landing in the same crowded space.

### Common flags

```
--top N                 # cap competitor count per query (default 10, max 50)
--region CODE           # ISO region code, e.g. TW, US, JP — narrows search
--lang CODE             # relevance language hint, e.g. zh, en, ja
--fresh                 # bypass local YouTube API cache
```

## Core flow

1. Parse argument. If `--series` is present, mode = `series`; else mode = `per-topic` and the remaining argument is the topic. Reject empty per-topic invocation with a one-line ask.
2. Read `SERIES_GUIDE.md` and resolve the active series from `.ars/config.json`. The agent needs the series' tone, audience, and visual direction to gauge gap fit.
3. **Per-topic mode**:
   - Run `npx ars research search "<topic>" [--max N] [--region CODE] [--lang CODE] [--fresh]` and capture the JSON.
   - If competitors look thin (< 3 results), retry once with a broader query (drop adjectives) and pass both queries to the agent.
4. **Series mode**:
   - Run `npx ars research list-recent-topics [--limit N] --json` to get the recent-topic snapshot.
   - For each topic with a non-null `thesis`, run `npx ars research search "<thesis or topic>"` (cap at 3-5 topics).
   - Pass the aggregated results to the agent.
5. Hand off to `ars:researcher` with:
   - mode (per-topic | series)
   - topic (per-topic only) or recent-topics list (series only)
   - active series + SERIES_GUIDE summary
   - the captured search JSON(s) verbatim
   - target output path (see below)
6. After the agent writes the file, summarize in the Claude Code response (one short paragraph + bullets) and suggest next step:
   - Per-topic → `/ars:plan <topic>` next, optionally pasting the suggested thesis line
   - Series → `/ars:reflect --days <window>` next

## Output

The agent writes to `.ars/research/<YYYY-MM-DD>-<slug>.md`:
- Per-topic: slug is a kebab-case 3-5-word condensation of the topic (e.g. `agentic-ide-comparison`)
- Series: slug is `series-<series-name>`
- If `--epId` was passed in per-topic mode, prepend the slug with the epId (`ep023-agentic-ide-comparison`)

Format contract is in `references/output-shape.md`. The agent must follow it.

Every directional suggestion is tagged `(suggested, low confidence)`. `/ars:reflect` is instructed to discount these blocks — do not let the agent strip the tag.

## Rules

- **Always use `npx ars research search` / `list-recent-topics`.** The CLI handles YouTube OAuth (reuses the `/ars:analytics` scope), retries, and 24h caching. Do not curl YouTube endpoints directly. Do not `node -e` your own fetch script.
- If the CLI reports missing credentials, tell the user to add `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` to `.env` and stop. Do not fall back to general WebSearch.
- **Per-topic** is the primary mode. Reach for `--series` only when the user explicitly wants series-level context or is about to run `/ars:reflect`.
- The output is **evidence + suggestion**, not a plan. Do not let the agent emit a structure table, narration, or step list. That is `/ars:plan`'s job.
- Do not overwrite the existing `.ars/research/<same-day>-<same-slug>.md` silently. If the file exists, append a `(re-run @ HH:MM)` suffix to the new file's name.

## References

- `references/output-shape.md` — `.ars/research/*.md` output contract (sections, table columns, suggestion confidence rules).
- `references/competitor-sourcing.md` — how to construct queries, when to enrich with WebFetch / Playwright, anti-patterns to avoid.

## Relationship to other skills

- **Before `/ars:plan`**: a recent (< 7 days) per-topic research file is auto-detected by the plan interview and fed to `ars:planner` as `<research_findings>`. Plan does not require research — it only takes advantage of it when present.
- **Before `/ars:reflect`**: series-mode research files are read by reflect as the 5th evidence type (market / competitive). Reflect treats them as one signal among many; it will not promote a `(suggested, low confidence)` block into `SERIES_GUIDE.md`.
