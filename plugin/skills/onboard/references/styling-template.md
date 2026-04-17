# STYLING.md Template

When writing `STYLING.md` during Phase 3, use this structure. Fill in the bracketed values from the brand interview. Keep the writing principles section intact — it applies to all channels.

---

```markdown
# STYLING.md — <Channel Name>

## Channel Identity

- **Channel name**: <channel name>
- **Audience**: <who watches — e.g. "developers and tech leads in Taiwan", "software engineers">
- **Tone**: <e.g. "direct and opinionated, occasional self-deprecating humor">
- **Language**: <primary language of narration>

## Narration Rules

- Write like you're talking to a friend, not presenting a slide deck.
- Sentences should be short. One idea per sentence.
- Use analogies before technical terms — always introduce the concept with a real-world metaphor first.
- Avoid AI-sounding filler phrases: "It's worth noting", "In today's world", "Let's explore", "Not only X but also Y", "The real challenge is not X but Y"
- <add channel-specific banned phrases here>

## Visual Direction

- Primary visual card: <e.g. "mockApp > mermaid > markdown">
- Preferred layout: <e.g. "title-card for most steps, card-only for code and charts">
- Card density: <minimal / balanced / dense>
- Use `ticker` sparingly — only for impact moments and chapter transitions, never as subtitles.

## Episode Structure

- Opening: Cover card with hook narration (first 2 sentences must grab attention)
- Body: Mix of visual cards — avoid 3+ consecutive cards of the same type
- Closing: Summary card with 2-4 takeaway points (thesis, not chapter list)

## Card Preferences

- `markdown` over `text` for all new content
- `mermaid` for relationships and flow; `timeline` for sequences and layers
- `compare` for A vs B; `markdown table` for multi-column data
- `flowchart` only when step-by-step progression is the point
- `code` always with `card-only` layout mode

## Step Length

- Each step narration: ideally under 20 seconds (~110 words)
- If narration exceeds 20 seconds, split into two steps with a visual card between them
- Card content must not duplicate narration — card = anchor, narration = story
```
