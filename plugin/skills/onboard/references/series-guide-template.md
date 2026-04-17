# SERIES_GUIDE.md Template

When writing `SERIES_GUIDE.md` during Phase 2 customize, use this structure. This file is not just branding. It is the series background brief that later planning, build, polish, and reflection work should inherit.

If the user gives sparse answers, do not block onboarding. Use the minimal defaults below, then let `/ars:reflect` refine the guide later from actual episode output and analytics.

## Do NOT invent content

This is the single biggest failure mode for this step. Follow these rules:

- Every field in `SERIES_GUIDE.md` must come from one of three sources: (a) an answer the user gave in the interview, (b) a value already present in `series-config.ts` or `.ars/config.json`, or (c) the minimal defaults verbatim from the section below.
- **Do not infer audience, mission, or takeaway from the channel name.** "人蔘Try Catch" does not imply "對 AI、軟體工程、技術管理有興趣的中文觀眾" — that is invention.
- If the user answered "沿用" / "same" / "default" / "skip" for an interview question, use the minimal default for that field and **say so in chat** ("Audience 沿用預設：XXX — 之後可以在 `/ars:reflect` 修正").
- If a required field was never asked (interview cut short, skill bug, etc.), STOP and ask the user before writing that field. Do not guess.
- It is better to write `<TBD — fill in after first episode>` in a field than to invent plausible-sounding content.

## Minimal defaults when the user is lazy

- **Host / creator**: `<TBD — ask before first episode>` (do not invent a persona; creator identity directly shapes what the series can credibly claim)
- **Audience**: interested viewers in this domain who want the point quickly, not a fully technical deep dive by default
- **Mission / vision**: explain the topic clearly, land one sharp takeaway, avoid bloated exposition
- **Narration voice**: direct, conversational, short sentences, no corporate filler
- **Language**: Traditional Chinese by default unless the repo/channel clearly implies another language
- **Visual system**: balanced card density, clear hero visual per section, reuse built-in layout from `series-config.ts`
- **Episode structure**: strong hook, 2-4 body sections, concise summary ending
- **Episode length range**: short 1–3 min / medium 3–6 min / long 6–30 min — the series may span the full range; actual length per episode is decided during `/ars:plan` based on source material density
- **CTA policy**: soft CTA by default; prefer description link / subscribe / comment depending the episode
- **Pacing**: usually 8-18 seconds per step; split anything that clearly runs long

Keep the writing principles section intact unless the user explicitly wants to change the house style.

---

```markdown
# SERIES_GUIDE.md — <Channel Name>

## Series Identity

- **Channel name**: <channel name>
- **Host / creator**: <one-line background of who is presenting — shapes what claims the series can credibly make>
- **Audience**: <default audience for the series>
- **Mission / vision**: <what this series is trying to help viewers understand or do>
- **Language**: <primary narration language>

## Narration Voice

- **Tone**: <e.g. "direct, opinionated, lightly playful">
- Write like you're talking to a smart friend, not presenting a slide deck.
- Sentences should be short. One idea per sentence.
- Use analogies before technical terms when it helps the audience get the idea faster.
- Avoid AI-sounding filler phrases: "It's worth noting", "In today's world", "Let's explore", "Not only X but also Y", "The real challenge is not X but Y"
- <add channel-specific banned phrases or speech habits here>

## Visual System

- **Hero visual bias**: <what kinds of visuals usually carry the story best>
- **Preferred layout**: <e.g. "mostly built-in streaming layout", "shorts layout for all episodes">
- **Card density**: <minimal / balanced / dense>
- **Motion bias**: <restrained / moderate / energetic>
- Use `ticker` sparingly — only for impact moments and chapter transitions, never as subtitles.

## Episode Structure Defaults

- **Episode length range**: <min–max, e.g. "1–3 min (short only)", "3–6 min (medium)", "6–30 min (long-form)", "1–10 min (mixed)"> — this is the *acceptable range* for the series, NOT a fixed per-episode length. Per-episode length is decided during `/ars:plan` based on source material density.
- **Opening**: <how the hook should feel>
- **Body**: <how the series usually develops an argument or story>
- **Closing**: <what kind of summary / payoff / CTA ending is preferred>

## Card / Layout Heuristics

- **Primary visual cards**: <e.g. "markdown > compare > mermaid">
- **Reuse bias**: prefer existing series-scoped cards before creating new ones
- `markdown` over `text` for most new content
- Use specialized cards when they make the point clearer in one glance than a generic card would
- Avoid long runs of visually identical cards unless repetition is the point

## Pacing Rules

- Each narrated step should usually stay under 20 seconds
- If a step runs long, split it into two beats with a stronger visual anchor
- Card content should not duplicate narration — card = anchor, narration = story

## CTA Policy

- **Default CTA style**: <soft / direct / mixed>
- **Default CTA destination**: <description link / comment / next video / subscribe>
- Only use a special CTA when the episode has a clear reason to do so

## Claim Boundaries

- Do not overclaim facts that are not sourced
- Flag uncertainty instead of bluffing
- Prefer concrete examples over abstract hype
- <add series-specific no-go zones, legal/compliance concerns, or recurring cautions here>
```
