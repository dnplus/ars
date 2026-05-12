---
name: ars:audio
description: Usage guide for generating MiniMax TTS audio and subtitles for an episode.
argument-hint: "[epId] [--steps <id1,id2,...>] [--step <id>] [--speed <0.5-2.0>] [--no-subtitle]"
model: claude-haiku-4-5-20251001
effort: low
---

Audio is not a standalone workflow stage in ARS. It happens inside the review phase: the user can trigger full-episode audio from the studio's `generate-full-audio` button or by using this skill.

Use this skill as an execution guide for TTS audio generation and subtitle refresh on the target episode.
The provider is resolved from `src/episodes/<activeSeries>/series-config.ts` via `SERIES_CONFIG.speech.provider`.
ARS beta currently supports MiniMax only.

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
- If `SERIES_CONFIG.speech.provider` is not `minimax`, stop and tell the user ARS beta currently supports MiniMax only.
- If `MINIMAX_API_KEY` or `MINIMAX_GROUP_ID` is missing, tell the user to add them to `.env` and stop.

## 發音字典預備（TTS 前）

在執行 `npx ars audio generate` 之前，先確認 `cli/pronunciation_dict.yaml` 是否需要補充。審查原則如下：

**優先處理（主動補充）：**
- 中文多音字／異讀字（例：「長」讀 cháng 或 zhǎng、「行」讀 háng 或 xíng）
- MiniMax 容易誤讀的中文專有名詞或縮寫（例：英文縮寫被當作逐字拼讀的中文詞）
- 本集特定的術語，且有明確理由相信 TTS 會讀錯

**不要主動補充：**
- 英文技術名詞、產品名稱、框架名稱（如 React、Docker、PostgreSQL）
- 英文縮寫（如 API、CPU、CI/CD）
- 任何你「猜測」MiniMax 可能讀錯但未有實際聽到問題的項目

**原則：**
- 每次只為本集加入有必要的少量條目，避免讓字典膨脹成通用詞庫。
- 英文發音問題留給聆聽輪（listening round）實際發現後再修正；ars:apply-review 會把發音修正 intent 路由到字典。
- 如果使用者未明確要求，不要批量加入英文詞條。

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

After success (and any auto-fix), guide the user back into the listening round of review. The listening round is the right place to catch pronunciation issues — especially English terms and product names that were intentionally left out of the pre-TTS dictionary pass.

Suggest in this order:
1. Open (or return to) Studio review with a Monitor attached. Before running `npx ars studio <epId> --phase review`, check whether this Claude session already has Studio and the Studio intent Monitor running for the same `<epId>`. Reuse them if present. If Studio is open but the Monitor is missing, start the Monitor immediately. If another episode's Monitor is running, stop it, run `npx ars workstate switch <epId> --stage review`, then open/reuse Studio for this episode. Never leave the user in Studio without an intent Monitor.
2. `/ars:apply-review latest` (or the agent watching the loop) will route pronunciation intents to `cli/pronunciation_dict.yaml` and re-run `npx ars audio generate <epId> --step <stepId>` for just that step.
3. Re-run full-episode or per-step audio generation as needed until the listening round is clean.
