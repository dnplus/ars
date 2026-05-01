# plan.md shape reference

Detailed shape rules for the `plan.md` agenda. The `/ars:plan` skill enforces these through delegation; the `ars:planner` subagent follows them when writing.

## Intent

`plan.md` is **an agenda the user reviews in 1-3 minutes** to approve or redirect direction. Not a script. Not a storyboard. Not a content dump. Every line should help the user decide "方向對不對".

If a draft reads like finished content (paragraphs, narration, timings, restated series rules), it is doing the build's job.

## Format: markdown, reviewed in Studio

`plan.md` is read inside Studio's Plan phase, which renders markdown (including tables) with CJK-aware typography. Use tables where they fit — they are the most efficient shape for `## Structure`. Fall back to bullet lists when a row would need multiple sentences per cell.

The shape below is the contract.

## Sections

Fixed output contract, in this order:

- `## Topic`
- `## Structure`
- `## New card`
- `## References`
- `## Reminders`

Do not add `## Steps`. Do not create `card-specs/` files.

## `## Topic`

Label-prefixed lines, one line per field (wrap continuations with indent):

```
## Topic

- Audience      <who this is for>
- Thesis        <one-sentence takeaway>
- CTA           <action, or "Per SERIES_GUIDE">
- Hero visual   <one-phrase visual promise>
- Source        <where the content comes from>
- Target length <number + one-clause reason, e.g. "5 分鐘，新工具評測 + 場景判斷，約 10 narrated beats">
- Constraints   <episode-specific limits: sensitive-topic, legal, tone>
```

Do not repeat `Target length` per phase.

## `## Structure`

One row per **review section**, not necessarily one final `ep.ts` step. Table format — Studio renders it cleanly and the scan-speed beats vertical blocks:

```
| #  | Section       | Goal                              | Visual                       | Card              | Notes                    |
|----|---------------|-----------------------------------|------------------------------|-------------------|--------------------------|
| 1  | <section>     | <one sentence of intent>          | <one phrase, think FIRST>    | <card-name>       | <one-phrase direction>   |
| 2  | <section>     | ...                               | ...                          | (NEW) <proposed>  | ...                      |
```

Column rules:
- `#` — section index, starting at 1
- `Section` — short label (`Hook`, `Problem`, `Demo`, `CTA`, …)
- `Goal` — one sentence, what this step communicates
- `Visual` — one phrase, the visual hook. Think visual first, then pick a card
- `Card` — card name only. Must come from `ars card list`, OR be prefixed `(NEW)` with a matching entry in `## New card`
- `Notes` — one phrase of direction or constraint. No narration, no per-beat timings

When the row picks `image`, **default conceptual / hero / brand visuals to a generated branded SVG asset** — say `generated SVG` in `Visual` or `Notes`. This is the first choice for `image`, not a fallback. Use SVG for prompt→result mocks, before/after concepts, input→output system sketches, hero conceptual visuals, branded diagrams, and any beat where a single memorable frame matters more than photographic accuracy.

Pick a real screenshot, photo, or downloaded asset for `image` when the beat is **claim-bearing evidence** (the source must be the actual artifact — a real UI screenshot, a published chart, a primary-source document, a real-world photo). When the row is conceptual and already uses `image`, plan for SVG; the user can swap in a real screenshot during Studio review if they decide the actual artifact reads better.

Do not choose `image` only because SVG is available. Keep `markdown` for compact editable wording, simple tables, exact lists, staged progression, and direct A/B framing. For static diagrams (architecture, sequence-of-concepts, layered relationships), default to `mermaid`; promote to `image` with generated SVG only when the diagram is a load-bearing hero/anchor frame or needs a visual metaphor. Use `mermaid` whenever Mermaid grammar is the point (sequenceDiagram / classDiagram / ER / gantt).

If a cell needs more than one sentence, either trim it or drop that row out of the table and write it as a numbered block under the table — don't pack paragraphs into cells.

Structure row count roughly tracks review complexity, not final video length:
- short 1-3 min episode → 3-5 review sections
- medium 3-6 min episode → 5-8 review sections
- long 6-30 min episode → 8-16 review sections

`/ars:build` owns the final step expansion. A long review section may become 2-4 narrated `ep.ts` steps so the final video still lands near the Target length. Do not inflate `plan.md` just to encode every estimated narration beat.

## `## New card`

When the Visual → Card transition cannot be satisfied by a built-in or existing series card, open a block here. The block **shows the reasoning** — this section is where new-card thinking lives, not hidden inside Structure cells.

One block per proposed card:

```
[<proposed-card-name>]
  Candidate steps:  [<N>, <M>, ...]         <-- which Structure steps want this card
  Built-in audit:
    - <card-A>:     <what it can do / what it lacks for this visual>
    - <card-B>:     <what it can do / what it lacks for this visual>
    - <card-C>:     <what it can do / what it lacks for this visual>
  Why new card:     <1-2 sentences — what the combined gap is>
  Concept:          <one-glance visual promise, not a spec or data shape>
```

The `Built-in audit` must name **at least two** plausible built-ins and say what each one falls short on. This is the anti-complacency step — "cover 能用就用" and "mermaid 湊合" die here because the audit forces the planner to say out loud why those cards lose.

If no new card is needed this episode, write:

```
## New card

（無——既有卡片足以覆蓋所有視覺需求）
```

See `custom-card-guide.md` for the decision rule.

## `## References`

Cite everything researched — text AND visual:

```
## References

- <title>
  <url>
- <title>
  <url>
- [image] <short description>
  <url or path>
- [screenshot] <short description>
  <path>
```

Include:
- primary-source URLs for claims (preferred over secondary reporting)
- image URLs from WebSearch image results (product shots, chart snapshots, diagrams, historical photos)
- Playwright screenshot paths when a live site / dashboard was captured
- official logo / brand asset links

If an image is load-bearing for a specific Structure step, also mention it in that step's `Visual:` line so build can find it without scanning all references.

## `## Reminders`

Bullet list. Only non-obvious, episode-specific gotchas build would miss (sensitive-topic handling, claim boundaries, visual cadence). Skip anything already in `SERIES_GUIDE.md` — build reads the guide too. Research gaps go here, not into new research calls.

```
## Reminders

- <constraint or gotcha — 1-2 lines>
- <constraint or gotcha — 1-2 lines>
```

## Reviewability budget

Total lines (counting everything, table rows count as one line each):
- 1-3 min episode → ~25-50 lines
- 3-6 min episode → ~40-70 lines
- 6-30 min episode → ~60-110 lines

Tables pack rows tightly, so budgets are tighter than the block-format era. Shorter is better when direction is clear.

## Never include

- Verbatim narration or opening lines ("第一句話必須是『…』")
- Per-beat second counts ("25 秒")
- Full sign-off / outro copy — write "Sign-off per SERIES_GUIDE"
- Anything already in `SERIES_GUIDE.md`
- Paragraphs in `Goal` / `Visual` / `Notes` cells — one sentence max per cell
