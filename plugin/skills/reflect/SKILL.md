---
name: ars:reflect
description: Reflect on recent episodes and analytics, then update SERIES_GUIDE.md with evidence-backed heuristics.
argument-hint: "[--days N] [--fresh] [--no-guide-update]"
model: claude-opus-4-6
effort: high
---

`/ars:reflect` is the feedback loop for a series. Use it after the repo has shipped multiple episodes and you want to tighten the recurring defaults in `SERIES_GUIDE.md`.

Goal:
- learn from actual episode output plus channel performance
- separate durable series heuristics from one-off episode noise
- update `SERIES_GUIDE.md` only when the evidence is strong enough

Behavior:
- Read `SERIES_GUIDE.md` first. Treat it as the current hypothesis set for this series.
- Resolve the active series from repo state. One repo maps to one active series.
- Review the most recent 3-5 episode source files in `src/episodes/<series>/`.
- Run `npx ars episode stats <series> --all --json` to inspect card usage, streaks, coverage, overused types, underused types, and gap signals.
- Prefer a recent analytics report from `.ars/analytics/`. If none exists and the repo has YouTube analytics configured, run `/ars:analytics` first using the requested `--days` window (default 28). If analytics is unavailable, continue with an episode-only reflection and say so clearly.
- Inspect recent processed Studio intents in `.ars/studio-intents/` as production-feedback evidence. Group them by `target.epId`, `target.anchorType`, `feedback.kind`, `feedback.severity`, and repeated message themes. Exclude `feedback.kind === 'build-trigger'` from heuristic analysis.
- When the latest episodes are not enough to explain a pattern, sample the corresponding `.ars/episodes/<epId>/plan.md` files to understand intended audience, angle, and CTA.
- Inspect `.ars/research/` for market / competitive evidence. Read both per-topic files (linked to specific epIds) and any series-mode landscape files. Group by topic-angle clusters and date so you can see whether the series keeps walking into the same crowded angle space.

Outputs:
- Write a reflection memo to `.ars/reflect/<YYYY-MM-DD>-<days>d.md`
- Unless the user passes `--no-guide-update`, patch `SERIES_GUIDE.md` with any high-confidence heuristic updates
- Summarize the key changes in the Claude Code response

Required memo sections:
- `## Window`
- `## Evidence`
- `## What seems to work`
- `## What seems weak`
- `## Proposed guide updates`
- `## Confidence and caveats`

Evidence expectations:
- Treat analytics as audience-response evidence.
- Treat episode stats as structure and visual-rhythm evidence.
- Treat plans as intent and packaging evidence.
- Treat Studio intents as production-friction evidence: what repeatedly required human correction before publish.
- Treat research files in `.ars/research/` as market / competitive evidence: where the series differentiated successfully and where it landed in crowded angle clusters. **Always discount `## Topic direction suggestions  (suggested, low confidence)` blocks — those are research-time guesses, not evidence. The `## Angle landscape` and `## Competitors` sections are the usable signal.**
- In `## Evidence`, include any repeated Studio intent patterns that affected the reflection, such as "3 content intents across recent Claude Code episodes asked for workflow clarification" or "multiple visual intents were one-off screenshot cleanups and were not used for guide updates."

Guide-update rules:
- Update operational defaults, not identity on a whim. Good targets:
  - `Episode Structure Defaults`
  - `Card / Layout Heuristics`
  - `Pacing Rules`
  - `CTA Policy`
  - specific lines in `Narration Voice` or `Visual System`
- Do **not** rewrite the channel mission, audience, or brand positioning solely because one episode spiked or dipped.
- Do **not** overfit to one top video. Look for repeated patterns across multiple episodes or clear analytics clusters.
- Distinguish packaging hypotheses from content hypotheses. If the data only shows title/thumbnail style effects, do not pretend it proved a narrative rule.
- Do **not** promote one-off Studio intents directly into `SERIES_GUIDE.md`. Single factual fixes, screenshot masking mistakes, pronunciation fixes, and isolated taste calls belong in the memo unless the same pattern repeats across episodes.
- If the evidence is weak or conflicted, leave `SERIES_GUIDE.md` unchanged and capture the uncertainty in the memo instead.

Reflection heuristics:
- Treat sample size honestly:
  - 1-2 episodes = exploratory only
  - 3-5 episodes = enough for small tactical updates
  - 6+ episodes plus analytics consistency = stronger guide edits are allowed
- Prefer changes that sharpen defaults instead of replacing the whole guide.
- If an existing rule in `SERIES_GUIDE.md` is contradicted by repeated evidence, revise that rule directly instead of appending a duplicate note.
- When proposing a new heuristic, tie it to concrete evidence from episode structure, card usage, or analytics movement.
- Repeated medium/high severity Studio intents can justify guide updates when they point to the same planning, narration, pacing, card, or CTA failure mode across multiple steps or episodes.
- Do **not** chase competitor patterns blindly. Differentiation evidence from `.ars/research/` is one signal — combine with audience-response (analytics) before re-pointing the series. If multiple recent research files flag the same crowded cluster the series keeps walking into, that is a stronger signal than a single landscape; if a research file is the only evidence pointing toward a guide change, leave the guide alone and capture the observation in the memo instead.

Examples of valid outcomes:
- "Open more quickly; the strongest episodes land the thesis within the first 2 steps."
- "Reduce long markdown runs; episodes with 3+ consecutive text-heavy cards correlate with weaker retention signals."
- "Default CTA should stay soft and point to the description unless the episode is explicitly campaign-driven."
- "Repeated review intents asked for the same workflow concept to be clarified, so future plans should introduce the underlying workflow before naming the product feature."

Examples of invalid outcomes:
- "Everything should be shorts now" based on one good short
- "Audience is now founders, not engineers" with no repeated evidence
- "Always use card X" when the win likely came from topic choice or packaging
- "Always avoid screenshots" because one Studio intent asked to mask a leaked value
