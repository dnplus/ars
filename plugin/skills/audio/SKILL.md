---
name: ars:audio
description: Generate TTS audio and subtitles for an episode using MiniMax.
argument-hint: "[epId] [--steps <id1,id2,...>] [--step <id>] [--speed <0.5-2.0>] [--no-subtitle]"
model: claude-sonnet-4-6
effort: low
---

Run TTS audio generation for the target episode.

## Command

```
npx ars audio generate <epId> [options]
```

- `<epId>` only — no series prefix. The active series is resolved from `.ars/config.json`.
- Options: `--speed <0.5-2.0>`, `--steps <id1,id2,...>`, `--step <id>`, `--no-subtitle`

## Behavior

- If the user provides an epId as the skill argument, use it directly.
- If no epId is provided, infer it from recent context or ask.
- Run the command and report: how many steps succeeded/failed, total audio duration, and whether subtitles were updated.
- If `MINIMAX_API_KEY` or `MINIMAX_GROUP_ID` is missing, tell the user to add them to `.env` and stop.
- After success, remind the user that the next step is `/ars:prepare-youtube <epId>`.
