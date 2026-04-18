# Branding Interview Guide

Use this guide during Phase 2 customize to collect brand information and derive theme tokens.

Channel name, YouTube publishing, and layout are already handled by `npx ars init` — do not re-ask them here. TTS provider/default voice now live in `series-config.ts` under `SERIES_CONFIG.speech`.

## Interview Questions

Ask these in order, **one question at a time**. Wait for the user's reply before asking the next question.

Interview rules:
- Default to a conversational flow, not a form dump.
- If the user answers multiple questions in one reply, capture the answered fields and skip them.
- Do not re-ask information the user already gave clearly.
- Accept "reuse defaults" / "same" / "default" / "skip" as an answer — record it as "use template default" for that field, do NOT silently invent richer content.
- Stop as soon as the user says "do it later."
- If the user is lazy or says "just do your best", stop the interview and fall back to the minimal defaults in `references/series-guide-template.md`.

### Visual identity (→ `series-config.ts`)

1. **Primary color** — Do you have a brand color? (hex preferred; can describe if not)
2. **Visual tone** — Warm/earthy, cool/tech, minimal/clean, or something else?
3. **Font** — Any preferred font? (defaults to Noto Sans TC for CJK, Inter for Latin)
4. **VTuber** — Do you have a VTuber character? If yes, ask them to drop the images in `public/episodes/<series>/shared/vtuber/`. If not, set `shell.config.vtuber.enabled = false` in `series-config.ts` instead of leaving broken image paths around.

### Series identity (→ `SERIES_GUIDE.md`)

These drive `SERIES_GUIDE.md` and are **required** — do NOT invent them from channel name alone. If the user says "reuse defaults" / "default", use the minimal defaults from `references/series-guide-template.md` verbatim and tell them which defaults you used.

5. **Host / creator** — Who is presenting this series? (one-line background, e.g. "senior backend engineer and small-team lead", "indie developer", "ServiceNow consultant") — drives narration credibility and the depth of claims the series can make.
6. **Audience** — Who is this series for? (one line, e.g. "experienced engineers in Taiwan who want practical AI workflow examples")
7. **Mission / takeaway** — What should a viewer walk away with after each episode? (one sentence)
8. **Narration tone** — Pick one or describe: direct / opinionated / playful / didactic / other
9. **Episode length range** — what length spectrum does this series cover? short 1–3 min / medium 3–6 min / long 6–30 min / mixed (any combination). Per-episode length is decided at `/ars:plan` time based on source material — this question sets the *acceptable range*, not a per-episode default.
10. **CTA policy** — Soft (description link / subscribe) / Direct (call out action) / Mixed / None

`brandTag` is derived — default to `EP`. Offer to set it only if the user spontaneously mentions episode-type labeling (e.g. "I want each episode tagged as Tutorial / Deep Dive"). Don't ask proactively.

## Color Derivation Rules

When you only have a primary hex color, derive the full palette:

```
primary       → brand color as-is
secondary     → primary H unchanged, S -20%, L -15%
accent        → primary H unchanged, S -10%, L +10%

surfaceDark   → primary H, S -40%, L 10-15%  (dark mode base)
surfaceCard   → surfaceDark L +5%
surfaceCardHeader → surfaceDark
surfaceLight  → primary H, S -60%, L 94-97%  (light/cream bg)
surfaceCode   → #1e1e1e (fixed)

onDark        → surfaceLight color
onCard        → surfaceLight color
onLight       → surfaceDark color
onPrimary     → #ffffff if primary is dark, #000000 if light

gradientDark  → linear-gradient(135deg, surfaceDark, surfaceCard)
gradientGold  → linear-gradient(135deg, primary, accent)
border        → primary H, S -30%, L 30-35%
shadow        → primary hex + alpha 0.2
```

## Visual Tone → Color Guidance

| Tone | Primary range | Surface feel |
|------|--------------|-------------|
| Warm/earthy | Browns, tans, amber (#c4a77d range) | Warm off-whites, dark browns |
| Cool/tech | Blues, teals, indigo (#4a7fb5 range) | Dark navy/slate, cool grays |
| Minimal/clean | Neutral grays, slate | Near-white light bg, charcoal dark |
| Vibrant | Any saturated hue | High contrast light/dark |

## What to Write Back

After the interview, update `series-config.ts`:
- Replace all placeholder colors in `theme.colors`
- Set `fontFamily` to chosen font (use Google Fonts via `@remotion/google-fonts/<FontName>` if available)
- Update `vtuber.closedImg` / `openImg` paths if user provided images
- If the series does not use a VTuber avatar, explicitly set `vtuber.enabled = false`
- Only touch `episodeDefaults.brandTag` if the user explicitly asked for a custom tag

Do NOT touch `episodeDefaults.channelName` during the branding interview — `npx ars init` already set it.

For `shell.layout`:
- In normal onboarding, leave the built-in layout choice from `npx ars init` as-is.
- Only change it if the user explicitly wants to switch between built-in `'streaming'` / `'shorts'`, or they are intentionally setting up a series custom layout override.

Then write `SERIES_GUIDE.md` — see `references/series-guide-template.md`.
