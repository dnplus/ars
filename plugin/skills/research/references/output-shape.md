# `.ars/research/*.md` shape reference

Detailed shape rules for the per-topic / series research artifact. The `/ars:research` skill enforces these via delegation; the `ars:researcher` subagent follows them when writing.

## Intent

A research file is the **market context the user reviews before planning** and the **competitive evidence `/ars:reflect` aggregates over time**. It is not a plan, not a script, not an audience-research report. Every line should help downstream readers see the angle landscape and proposed differentiation.

## Sections

Fixed output contract, in this order:

- `## Window`
- `## Competitors`
- `## Angle landscape`
- `## Topic direction suggestions  (suggested, low confidence)`
- `## References`

The `(suggested, low confidence)` tag in the fourth section header is **part of the contract**. Do not strip it. `/ars:reflect` reads it to know which blocks to discount.

## `## Window`

Label-prefixed lines, one per field:

```
## Window

- Mode          per-topic | series
- Topic         <one-line topic>            (per-topic only)
- Scope         近 N 集主題：epXXX, epYYY    (series only)
- YouTube query <exact query string>
- Region        <CODE or — >
- Language      <CODE or — >
- Fetched       <N> competitors
- Episode link  <epId or — >
- Run at        <YYYY-MM-DD HH:MM>
```

If multiple queries were used (e.g. broad + narrow retry), list each on its own `YouTube query` line and note which one's results the rest of the file is based on.

## `## Competitors`

Table format. Studio renders it cleanly; reflect can scan vertically:

```
| #  | Channel                | Title                        | Angle               | Hook (first 10s)        | Views   | Published    | URL |
|----|------------------------|------------------------------|---------------------|-------------------------|---------|--------------|-----|
| 1  | <channelTitle>         | <video title>                | <one-phrase angle>  | <hook in ≤ 12 chars>    | 1.2M    | 2025-11-03   | <url> |
| 2  | ...                    | ...                          | ...                 | ...                     | ...     | ...          | ... |
```

Column rules:
- `#` — index, starting at 1, ordered by relevance from the search result
- `Channel` — `channelTitle` from the CLI output, untouched
- `Title` — `title` from the CLI output, trim if longer than 60 chars
- `Angle` — your one-phrase classification (`tutorial`, `review`, `comparison`, `drama`, `explainer`, `deep dive`, `first impression`, `hot take`, …). Reuse the same labels across rows so clusters surface in `## Angle landscape`.
- `Hook (first 10s)` — only fill if you watched the open or read a transcript. Otherwise leave `—`. Do not infer from title.
- `Views` — from `viewCount`. Format as `1.2M` / `345K` / `12,300`. If 0 or missing, write `—`.
- `Published` — `YYYY-MM-DD` slice of `publishedAt`
- `URL` — full youtube.com link

If the search returned fewer than 3 rows, keep the table small but **do not pad with weakly-related results**. Note the small sample in `## Window > Fetched`.

## `## Angle landscape`

Three bullet groups, in this order:

```
## Angle landscape

- 已被多次涵蓋的角度（≥3 競品）：
  - <angle>: <brief summary> (#1, #4, #7)
  - <angle>: <brief summary> (#2, #5)
- 中度涵蓋的角度（1-2 競品）：
  - <angle>: <brief summary> (#3)
- 沒人做過的差異化空間：
  - <gap description>: <why this gap is plausible given the competitor set>
```

Rules:
- Reference competitors by `#` from the table — that is what makes this section auditable.
- A "gap" must be **observable from the competitor set**, not invented. If the gap exists only because you searched too narrowly, say so in the bullet.
- Series mode aggregates across topics; the `#` references then need the topic disambiguator: `(topicA #1, #4)`. Use a sub-bullet per topic if the table grew long.

## `## Topic direction suggestions  (suggested, low confidence)`

Header tag is **mandatory and verbatim**. Body:

```
## Topic direction suggestions  (suggested, low confidence)

- Suggested thesis        <one sentence>
- Suggested hero visual   <one phrase>
- Differentiation rationale  <why 這個方向避開 ## Angle landscape 的 crowded cluster>
- Risks                   <what could make this thesis fall flat — sample size, audience fit, packaging dependence>
- Alternative direction   <one-sentence runner-up — optional, only if you saw a clear second-best>
- Confidence reason       <why this block stays low confidence — e.g. "10 results in TW only", "thumbnails not enriched">
```

Rules:
- One field per line, label + tab/spaces + value. Same shape as `plan.md`'s `## Topic`.
- Do **not** propose a step structure here. That is `/ars:plan`'s job. The hero visual is one phrase, not a card spec.
- If the angle landscape was inconclusive (no clear gap), write the suggestion as `Suggested thesis: 維持系列既有角度，未發現明顯競品 cluster gap`. Do not invent a gap.
- The block stays low confidence even if you found a strong gap. If you genuinely think you have high-confidence guidance, that belongs in `/ars:reflect`'s output, not here.

## `## References`

Cite competitors and any extra material the agent fetched:

```
## References

- <video title>
  <url>
- [image] <thumbnail of #N>
  <url or path>
- [screenshot] <channel page or related dashboard>
  <path>
- [article] <supporting context article>
  <url>
```

Include:
- every competitor URL from `## Competitors`
- thumbnail URLs / local paths if you saved them via Playwright (helps `/ars:plan` build the hero visual contrast)
- channel-page screenshots when the channel context (subscriber count, publish cadence) shaped the cluster reading
- non-YouTube articles only if they directly informed the angle clustering

## Length budget

- Per-topic file: ~40-90 lines total (table rows count one each)
- Series file: ~80-180 lines (multi-topic aggregation expected)

If the file grows beyond this, the agent is summarizing too much per row. Tighten to one phrase per cell.

## Never include

- Step structures or storyboards (that is `plan.md`)
- Verbatim narration or opening lines
- Audience research that the search results cannot support (e.g. "viewers want X" — the search did not interview anyone)
- Speculation about *why* a competitor's view count is high — note packaging signals (thumbnail, title) at most
- A claim of high confidence on directional suggestions
