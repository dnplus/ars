# Branding Interview Guide

Use this guide during Phase 3 customize to collect brand information and derive theme tokens.

## Interview Questions

Ask these in order. Stop as soon as the user says "do it later."

1. **Channel name** — What's the full display name of your channel?
2. **Brand tag** — Short label shown on episode covers (e.g. `EP · Tutorial`, `EP · Deep Dive`). Usually `EP · <type>`.
3. **Primary color** — Do you have a brand color? (hex preferred; can describe if not)
4. **Visual tone** — Warm/earthy, cool/tech, minimal/clean, or something else?
5. **Font** — Any preferred font? (defaults to Noto Sans TC for CJK, Inter for Latin)
6. **VTuber** — Do you have a VTuber character? If yes, ask them to drop the images in `public/episodes/<series>/shared/vtuber/`
7. **Voice** — MiniMax voice ID or leave as default `female-shaonv`?
8. **Layout** — `streaming` (16:9 horizontal, standard YouTube) or `shorts` (9:16 vertical, YouTube Shorts)? The walkthrough demo uses `streaming`. Default: `streaming`.

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
- Update `episodeDefaults.channelName` and `episodeDefaults.brandTag`
- Update `vtuber.closedImg` / `openImg` paths if user provided images
- If user chose `shorts`, change `shell.layout` from `'streaming'` to `'shorts'`

Then write `STYLING.md` — see `references/styling-template.md`.
