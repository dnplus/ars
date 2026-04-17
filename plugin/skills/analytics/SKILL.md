---
name: ars:analytics
description: Query YouTube analytics through ARS helpers and produce a concise channel report for Claude Code.
argument-hint: "[--days N] [--fresh]"
model: claude-sonnet-4-6
effort: medium
---

Use the existing YouTube helpers in `cli/lib/youtube-client.ts` as the source of truth for auth, cache, Analytics API queries, and Data API lookups.

Behavior:
- Treat this as a Claude Code workflow/reporting skill, not a public core CLI surface.
- Require YouTube credentials (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`) before attempting analytics queries.
- Default to a 28-day lookback window when the user does not specify `--days`.
- Respect `--fresh` by bypassing the local `.cache/youtube-analytics/` cache.
- Produce a concise report that emphasizes decisions, not raw tables.

Recommended flow:
1. Load credentials with `loadCredentials()`.
2. Resolve the reporting window using `parseDaysFlag(args)` and `safeEndDate()`.
3. Query channel-level summary data first.
   - Use `getChannelInfo()` for channel title and top-level context.
   - Use `queryAnalytics()` for recent views, watch time, subscribers gained/lost, and daily trends.
4. If useful, enrich with `getVideoDetails()` for top-performing videos mentioned in the report.
5. Summarize the findings into a human-readable report.

Suggested report sections:
- Window: exact date range covered
- KPI snapshot: views, watch time, subscriber delta
- Trend read: what moved up/down and whether the move looks meaningful
- Top videos: 3-5 items with why they likely worked
- Risks / anomalies: sudden drops, weak CTR proxies, overconcentration
- Next actions: concrete content or packaging recommendations

Output:
- Write the report to `.ars/analytics/<YYYY-MM-DD>-<days>d.md`
- Also summarize the key findings in the Claude Code response
- If the user wants to turn the findings into series-level defaults, suggest `/ars:reflect --days <same-window>`

Rules:
- Prefer direct metric interpretation over dumping raw API rows
- Keep the report concise and decision-oriented
- If credentials are missing, stop and tell the user to configure them instead of guessing
- If analytics data is unavailable, report the failure clearly and do not fabricate numbers
