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
- Target length <number + one-clause reason, e.g. "5 分鐘，新工具評測 + 場景判斷，6-7 steps">
- Constraints   <episode-specific limits: sensitive-topic, legal, tone>
```

Do not repeat `Target length` per phase.

## `## Structure`

One row per step. Table format — Studio renders it cleanly and the scan-speed beats vertical blocks:

```
| #  | Section       | Goal                              | Visual                       | Card              | Notes                    |
|----|---------------|-----------------------------------|------------------------------|-------------------|--------------------------|
| 1  | <section>     | <one sentence of intent>          | <one phrase, think FIRST>    | <card-name>       | <one-phrase direction>   |
| 2  | <section>     | ...                               | ...                          | (NEW) <proposed>  | ...                      |
```

Column rules:
- `#` — step index, starting at 1
- `Section` — short label (`Hook`, `Problem`, `Demo`, `CTA`, …)
- `Goal` — one sentence, what this step communicates
- `Visual` — one phrase, the visual hook. Think visual first, then pick a card
- `Card` — card name only. Must come from `npx ars card list`, OR be prefixed `(NEW)` with a matching entry in `## New card`
- `Notes` — one phrase of direction or constraint. No narration, no timings

If a cell needs more than one sentence, either trim it or drop that row out of the table and write it as a numbered block under the table — don't pack paragraphs into cells.

Structure step count roughly tracks target length: short 3-5 steps, medium 5-8, long 8-16.

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
- Per-step second counts ("25 秒")
- Full sign-off / outro copy — write "Sign-off per SERIES_GUIDE"
- Anything already in `SERIES_GUIDE.md`
- Paragraphs in `Goal` / `Visual` / `Notes` cells — one sentence max per cell
