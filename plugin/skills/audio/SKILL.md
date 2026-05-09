---
name: ars:audio
description: Usage guide for generating TTS audio (MiniMax or VoxCPM) and subtitles for an episode.
argument-hint: "[epId] [--steps <id1,id2,...>] [--step <id>] [--speed <0.5-2.0>] [--no-subtitle]"
model: claude-haiku-4-5-20251001
effort: low
---

Audio is not a standalone workflow stage in ARS. It happens inside the review phase: the user can trigger full-episode audio from the studio's `generate-full-audio` button or by using this skill.

Use this skill as an execution guide for TTS audio generation and subtitle refresh on the target episode.
The provider is resolved from `src/episodes/<activeSeries>/series-config.ts` via `SERIES_CONFIG.speech.provider`.
ARS supports `minimax` (hosted, native subtitle timing) and `voxcpm` (self-hosted via an OpenAI-compatible server like vLLM-Omni; no native subtitle timing).

## Command

```
npx ars audio generate <epId> [options]
```

- `<epId>` only — no series prefix. The active series is resolved from `.ars/config.json`.
- Options: `--speed <0.5-2.0>`, `--steps <id1,id2,...>`, `--step <id>`, `--no-subtitle`

## Behavior

- If the user provides an epId as the skill argument, use it directly.
- If no epId is provided, infer it from recent context or ask.
- Run the command in the background so the review flow stays responsive.
- When the command completes, report: how many steps succeeded/failed, total audio duration, and whether subtitles were updated.
- If `SERIES_CONFIG.speech.provider` is `minimax` and `MINIMAX_API_KEY` or `MINIMAX_GROUP_ID` is missing, tell the user to add them to `.env` and stop.
- If `SERIES_CONFIG.speech.provider` is `voxcpm` and `VOXCPM_API_BASE` is missing (and `speech.providerOptions.voxcpm.apiBase` is not set), tell the user to point it at a running OpenAI-compatible VoxCPM server (e.g. `vllm serve openbmb/VoxCPM2 --omni --port 8000`) and stop.
- For `voxcpm`, also pass `--no-subtitle` because the provider does not return native timing. The skill must NOT try to merge subtitles for VoxCPM runs.
- If `SERIES_CONFIG.speech.provider` is anything else (e.g. `elevenlabs`), stop and tell the user the adapter is not implemented yet.

## Post-generation validation (MANDATORY)

After audio succeeds, run `npx ars episode validate <epId>` and act on its output.

New episodes created by `npx ars episode create <epId>` already import `./<epId>.subtitles` and include an empty `subtitles,` field so audio generation can merge timed phrases in place. Older or hand-authored episodes may still be missing the import/use wiring. validate catches this as `❌ not imported in episode`. The skill MUST auto-fix it instead of punting to the user.

When validate reports `Subtitles file exists but episode does not import/use it`:
1. Read `src/episodes/<activeSeries>/<epId>.ts`.
2. If a line like `// import { subtitles } from "./<epId>.subtitles";` is commented, uncomment it. If the import is missing entirely, insert `import { subtitles } from "./<epId>.subtitles";` after the last existing import.
3. In the exported Episode object's metadata area, look for a commented `// subtitles,` line and uncomment it. If missing entirely, add `subtitles,` alongside other top-level Episode properties (typically next to `steps`).
4. Re-run `npx ars episode validate <epId>` to confirm `📎 Subtitles imported: ✅`.
5. Report the fix briefly in chat (one line, e.g. "補上了 ep025.subtitles 的 import 和 Episode 欄位").

Other validation issues (missing summary CTA, long points, deprecated cards) are advisory — surface them to the user but do not auto-fix unless asked.

## After success

After success (and any auto-fix), guide the user back into the listening round of review. Pronunciation issues are the common follow-up, and the studio is the place to catch them.

Suggest in this order:
1. Open (or return to) Studio review with a Monitor attached. Before running `npx ars studio <epId> --phase review`, check whether this Claude session already has Studio and the Studio intent Monitor running for the same `<epId>`. Reuse them if present. If Studio is open but the Monitor is missing, start the Monitor immediately. If another episode's Monitor is running, stop it, run `npx ars workstate switch <epId> --stage review`, then open/reuse Studio for this episode. Never leave the user in Studio without an intent Monitor.
2. `/ars:apply-review latest` (or the agent watching the loop) will route pronunciation intents to `cli/pronunciation_dict.yaml` and re-run `npx ars audio generate <epId> --step <stepId>` for just that step.
3. Re-run full-episode or per-step audio generation as needed until the listening round is clean.
