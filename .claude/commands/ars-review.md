---
name: ars-review
description: Start ARS review session — opens Studio and auto-processes fix intents in a loop
argument-hint: "<series>/<epId>  (e.g. template/ep-demo)"
---

# ARS Review

You are running the ARS review workflow for: **$ARGUMENTS**

## What this does

1. Launch Studio dev server for the target episode
2. Enter a watch loop: periodically check `.ars/review-intents/` for pending intents
3. For each pending intent: read it, apply the fix to the episode source, mark it processed
4. Repeat until the user stops the session

## Step 1 — Parse target

Parse `$ARGUMENTS` as `<series>/<epId>`. If missing or malformed, ask the user.

## Step 2 — Launch Studio

Run in background:
```bash
npx ars review open $ARGUMENTS
```

This starts the Vite dev server and opens the browser. Tell the user:
- Studio is running — open it in the browser to review slides
- 用 ✨ 按鈕標記問題（卡片左上 = 視覺、字幕列左側 = 口播、導覽列中央 = 整集）
- You (Claude Code) will pick up intents automatically

## Step 3 — Watch loop

Use `ScheduleWakeup` with `delaySeconds: 30` to re-check every 30 seconds.

On each wake-up:

### 3a. Read pending intents

```bash
npx ars review intent list
```

Or read `.ars/review-intents/*.json` directly. Filter for intents where `processedAt` is absent.

### 3b. Process each pending intent

For each pending intent:

1. Read the full intent JSON to understand:
   - `target.series`, `target.epId`, `target.stepId` — which step to fix
   - `feedback.kind` — `visual` (card design), `content` (narration/script), `other` (anything)
   - `feedback.message` — what to change

2. Find the episode file: `src/episodes/<series>/<epId>.ts`

3. Apply the fix:
   - `visual` → fix the step's card content, layout, or visual props
   - `content` → fix the step's `narration` field or script text
   - `other` → apply whatever the message describes

4. Mark the intent as processed:
   ```bash
   npx ars review intent clear <id>
   ```

5. Report what was fixed: step ID, kind, and a one-line summary

### 3c. Schedule next wake-up

```
ScheduleWakeup(delaySeconds: 30, prompt: "/ars-review $ARGUMENTS", reason: "checking for new review intents")
```

## Step 4 — Stop condition

Stop the loop when:
- User says stop / cancel / done
- No pending intents for 3 consecutive checks (session looks idle)

On stop: run `npx ars review intent list` one final time and summarise what was processed.

## Rules

- Never mark an intent processed without actually making the corresponding code change
- If a fix is ambiguous, make your best judgement based on the message — don't ask unless truly blocked
- Keep fixes minimal and scoped to the intent — don't refactor surrounding code
- After fixing, always run `npx tsc --noEmit` to confirm no TypeScript errors
