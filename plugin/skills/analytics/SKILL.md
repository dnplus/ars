---
name: ars:analytics
description: Query YouTube analytics through npx ars analytics fetch and produce a concise channel report for Claude Code.
argument-hint: "[--days N] [--fresh]"
model: claude-sonnet-4-6
effort: medium
---

Run `npx ars analytics fetch` to pull a JSON snapshot, then turn it into a narrative report. Do NOT hand-roll fetch calls against the YouTube API — the CLI already handles auth, caching, and data-delay windowing.

## Command

```
npx ars analytics fetch [--days N] [--fresh] [--top N]
```

- Default window is 28 days. Pass `--days N` to change it.
- Default `--top` is 10 video rows. Raise it only if the user asks.
- Use `--fresh` only when the user explicitly wants to bypass the local 24h cache.

The command prints a single JSON object to stdout with this shape:

```
{
  "window": { "days", "startDate", "endDate" },
  "channel": { "channelId", "title", "subscriberCount", "videoCount", "viewCount" },
  "summary": { "views", "estimatedMinutesWatched", "averageViewDuration", "subscribersGained", "subscribersLost", "likes", "comments", "shares" },
  "daily":   [{ "day", "views", "estimatedMinutesWatched", "subscribersGained" }, ...],
  "topVideos": [{ "videoId", "title?", "publishedAt?", "views", "estimatedMinutesWatched", "averageViewDuration", "averageViewPercentage" }, ...]
}
```

## Behavior

- Resolve the window from the user's request (default 28 days).
- Run the command once and capture its stdout. If exit is non-zero, surface the error as-is and stop — do NOT fall back to hand-rolled API calls.
- If the CLI reports missing credentials, tell the user to add `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` to `.env` and stop.
- Parse the JSON snapshot. Interpret metrics into a concise, decision-oriented report.

## Report shape

Use these sections, grounded in the snapshot:

- **Window** — exact date range from `window.startDate` → `window.endDate` plus the lookback length in days
- **KPI snapshot** — views, watch time (convert `estimatedMinutesWatched` to human-readable), subscriber delta (`subscribersGained - subscribersLost`)
- **Trend read** — call out what moved in `daily[]` (bumps, drops, cadence gaps). Quote specific dates.
- **Top videos** — 3–5 rows from `topVideos[]` with `title`, views, avg view duration, and a one-line take on why it likely worked
- **Risks / anomalies** — sudden drops, weak retention (low `averageViewPercentage`), overconcentration in a single video
- **Next actions** — concrete content or packaging recommendations grounded in the above

## Output

- Write the report to `.ars/analytics/<YYYY-MM-DD>-<days>d.md` using today's date.
- Summarize the key findings in the Claude Code response (one short paragraph + bullets).
- If the user wants to turn findings into series-level defaults, suggest `/ars:reflect --days <same-window>`.

## Rules

- **Always use `npx ars analytics fetch`.** Do not curl YouTube endpoints directly, do not `node -e` your own fetch script, do not search the repo for helper modules — the CLI subcommand is the contract.
- Prefer direct metric interpretation over dumping raw API rows.
- Keep the report concise and decision-oriented.
- If analytics data is unavailable or the snapshot is empty, report the failure clearly and do not fabricate numbers.
