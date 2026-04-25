# Competitor sourcing reference

How `ars:researcher` picks queries, enriches results, and avoids common failure modes when calling `npx ars research search`.

## Query construction

The `query` argument to `npx ars research search` is sent verbatim to YouTube `Search.list`. YouTube's search is more like keyword matching than semantic search — pick keywords the way a viewer would type them.

### Default per-topic query

- Strip filler words. `"How agentic IDEs change developer workflow"` → `"agentic IDE developer workflow"`.
- Keep one or two **named entities** (product, framework, technique) when the topic centers on them. They anchor the search.
- Drop subjective adjectives (`best`, `fastest`, `surprising`) — they bias the search toward listicles.
- Include the topic's **format hint** only if the angle depends on it (`comparison`, `tutorial`, `vs`, `review`). Otherwise leave it out so the angle map covers all formats.

### Retry on thin results

If the first query returns < 3 competitors:
1. Drop one keyword (the most specific one) and retry.
2. If still thin, switch to the umbrella concept (`agentic IDE` → `AI coding tool`).
3. Stop after 2 retries — record both queries in `## Window > YouTube query` so the user can see how the scope widened.

### Region and language

- `--region TW` + `--lang zh` narrows to Traditional Chinese results — useful when the series targets a CJK audience.
- `--region US` + `--lang en` is the default for English-speaking audiences.
- Avoid mixing — `--region TW --lang en` returns near-empty results because YouTube's index is split by language signal.
- For series mode, use the series' primary audience region. Do not loop over multiple regions in v1; that explodes the budget.

### Series mode query selection

Per recent topic, prefer the topic's **`thesis`** over the bare topic title — the thesis is already a sharpened angle. Fall back to topic title when thesis is null.

If a recent episode has neither, skip it and note in the agent output that the episode lacked a parseable `## Topic` block.

## Enrichment passes

The CLI returns titles, descriptions, channel names, view counts, durations, and thumbnail URLs. That is enough for the table and a first-pass angle classification. Enrich only when:

- A cluster is large (≥ 3 competitors share an angle) and you want to confirm the cluster isn't a mirage. Pick the highest-view-count member and `WebFetch` the description / chapters.
- A thumbnail looks like the visual hook itself (face + bold text overlay, before-after split, big chart). Note the visual hook in `Hook (first 10s)`. Use Playwright to capture the thumbnail at a known path under `.ars/research/assets/<filename>` if it informs the differentiation rationale.
- A channel name keeps showing up across the cluster. A quick channel-page fetch tells you whether they're a single-topic channel (cluster confirmed) or a generalist (cluster might be one-off coverage).

Cap enrichment at 2-3 fetches per per-topic run, 5-8 for series mode. Going deeper produces diminishing returns and burns context.

## Anti-patterns

- **Hand-rolling `fetch()`** to YouTube. Always use `npx ars research search`. The CLI handles auth refresh, caching, and the two-step `search.list` → `videos.list` join.
- **Searching repeatedly with similar queries** to "see if anything else comes up". Two queries max. The angle landscape comes from clustering, not from broader search.
- **Falling back to general WebSearch** when YouTube credentials are missing. The skill instructs you to stop and ask the user to configure `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN`. General web results don't carry the view-count signal that makes the cluster map useful.
- **Treating high view count as the angle signal**. View count is packaging variance plus topic interest. Use it to prioritize *which* representative to enrich, not to rank angles.
- **Inferring hook content from titles alone**. Either fetch the description / first chapter, or leave `Hook (first 10s)` as `—`. Inferring is worse than leaving blank.
- **Generating a thesis that mirrors the strongest competitor's**. The point of differentiation is to step *away* from clusters, not toward the highest-performing one.

## When to abort the run

Surface the failure to the user instead of writing a half-shaped file when:
- The CLI fails with a non-credentials error twice in a row (rate limit, network).
- All queries (initial + retries) returned 0 results — the topic is too niche or the keyword shape was wrong; ask the user to refine.
- Series mode finds zero parseable `## Topic` blocks across the recent episodes — there's nothing to query against.

In each case, do not pretend a thin file is useful. Stop and report what failed.
