---
name: ars:onboard
description: Three-phase ARS onboarding after `ars init` — walkthrough, customize, verify.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` is a guided setup flow for an already initialized ARS content repo.

## Prerequisite

Do not run onboarding as the repo setup command. Before this skill starts, the repo must already have:

- `.ars/config.json`
- `project.activeSeries`
- `src/episodes/<activeSeries>/ep-demo.ts`
- plugin skills installed by `ars init <series>`

If any of those are missing, stop and tell the user to run:

```bash
ars init <series-name>
```

Then tell them to launch `ars` again and run `/ars:onboard`.

Do not run `ars init` from inside this skill unless the user explicitly asks for recovery and confirms the target series name. `ars init` is the setup step before Claude Code; `/ars:onboard` is the guided walkthrough/customize/verify step after setup.

## Phase Transitions

At each phase transition, advance the workstate stage:

```bash
npx ars workstate set --stage <stage-name>
```

Valid onboard stages are:

- `onboard-walkthrough`
- `onboard-customize`
- `onboard-verify`

Do not invent extra setup phases. Repo setup belongs to `ars init <series>` before this skill starts.

## Output Contract

Treat `/ars:onboard` like a guided setup flow, not a raw agent log dump.

For every phase:

- start with a short phase intro:
  - where the user is now
  - what this phase is for
  - what artifact or readiness state it will leave behind
- end with a short handoff:
  - what just got completed
  - what the next phase will do
  - what the user should type or choose next

Keep the tone concrete and operational.

Prefer:

- `You are now in Phase 1 walkthrough: this is a demo-only pass to understand the workflow. It will not modify your series files.`
- `Next is customize: we will tune series-config.ts and SERIES_GUIDE.md for your channel.`
- `The goal of verify is to make sure this repo is actually ready for the first real episode.`

Avoid:

- long architecture explanations
- dumping shell output without interpretation
- saying only `done` / `pass` without telling the user what that means

## Re-run Detection

Do this before any workstate write or phase action.

Read `.ars/config.json` and check `project.customizedAt` and `project.onboardedAt`.

- `customizedAt` is stamped after customize, so a later verify failure does not lose the user's style/config notes.
- `onboardedAt` is stamped only after verify passes. It is the SSOT for "the full onboarding flow is complete".

Re-run logic:

- If neither is set: first onboard run. Start at Phase 1.
- If `customizedAt` is set but `onboardedAt` is not: customize already ran but verify did not finish. Write `onboard-verify` and resume at Phase 3.
- If `onboardedAt` is set: onboarding already completed. Write `onboard-customize`, enter confirmation mode, then continue to verify.

## Phase 1 — Walkthrough

Skip this phase if re-run detection determined the series is already customized.

Stage name: `onboard-walkthrough`

1. Write workstate with stage `onboard-walkthrough`.
2. Give a 2-3 sentence intro to ARS.
3. Before opening or reusing Studio, check whether this Claude session already has a running Studio process and Studio intent Monitor:
   - If Studio is already open for this same active series `ep-demo`, reuse it.
   - If Studio is open for this same target but no intent Monitor is running, keep the Studio process and start the Monitor immediately.
   - If Studio or the Monitor is for a different episode, stop the old Monitor first; do not let another episode's comments leak into onboarding.
4. Open Studio in the background only when there is no reusable Studio process, and do not wait for it to finish:

```bash
npx ars studio ep-demo --phase review
```

Keep the process handle / terminal session. Onboard must explicitly stop this Studio process when the flow ends or is aborted.

5. Immediately after opening or reusing Studio, start the Studio intent Monitor using the script in `## Studio Intent Monitor`. The Monitor starts in walkthrough and stays alive through customize and verify.
6. Immediately after launching, tell the user:
   - they are in Phase 1 walkthrough
   - this phase is demo-only and will not modify files
   - watch the output for the localhost URL and share it
   - keep the Studio tab open; onboard should reuse this session through customize and verify
   - browse the demo, then say `next` to continue to customize, or `skip` to skip the walkthrough

## Phase 2 — Customize

Stage name: `onboard-customize`

1. Write workstate with stage `onboard-customize`.
2. Read `.ars/config.json` and resolve `project.activeSeries`.
3. Brief the user before asking any questions. Keep it to 4-6 bullets and say this phase will:
   - tune `series-config.ts` for visible defaults such as channel name, tone, colors, layout bias, and VTuber/image settings
   - create or update `SERIES_GUIDE.md`, which future `/ars:plan`, `/ars:build`, Studio review fixes, and `/ars:reflect` runs will read
   - keep `ep-demo` as the preview surface so they can see the style evolve in Studio
   - avoid production/publish setup; YouTube and TTS were already handled by `ars init` and can be revisited later
   - take the short path by default, with an optional deeper voice/card-preference pass at the end
4. Ask the user to choose one path:
   - **quick customize** — recommended; invite one free-form answer, then ask only the minimum follow-ups needed
   - **keep template for now** — leave the initialized template as-is and stamp customize complete
   - **advanced reset from scratch** — only if the user explicitly wants to replace the initialized template with a minimal skeleton

When presenting the paths, explain the outcome of each one in one sentence.

Before the interview begins, align Studio with the current series:

- Tell the user to keep the Studio tab on `?series=<activeSeries>&ep=ep-demo&phase=review`.
- During customize, treat Studio as the live preview surface for series defaults. Tell the user comments on the demo are normally interpreted as brand/series-level requests (theme, typography, density, VTuber/assets/logo, tone, title style, card preference, recurring card behavior, pacing). If they only want to patch the demo card/step, they should say "只修這張 demo" in the comment.
- Confirm the Studio intent Monitor from Phase 1 is still running. If not, restart it immediately using `## Studio Intent Monitor` before asking customize questions.

## Studio Intent Monitor

Whenever Studio is opened or reused during onboarding, register an event-driven watch over `.ars/studio-intents/`.

Claude Code agents should use the Claude Code `Monitor` tool around:

```bash
npx ars studio intent watch
```

Other agents (Codex, OpenCode, shell-only runners, or any environment without Claude Code's `Monitor` tool) must still keep an active intent watcher. Start `npx ars studio intent watch` as a long-running background/terminal process and react to each stdout line, or poll `npx ars studio intent list --pending --json` every few seconds if long-running process handling is unavailable. Preserve the same stage guard, routing, and resolution rules below; lack of the `Monitor` tool is not a reason to ignore Studio comments or ask the user to mention them in chat.

Each stdout line is a notification. On every notification:

1. Stage guard: check `.ars/state/workstate.json`. If the current stage is not `onboard-walkthrough`, `onboard-customize`, or `onboard-verify`, stop the Monitor cleanly.
2. Run `npx ars studio intent list --pending --json`.
3. For each pending intent targeting the active preview episode:
   - Treat intents with `source.ui === "onboard"` or `source.hash` starting with `onboard:` as onboarding feedback, not ordinary episode review.
   - During `onboard-walkthrough`, do not patch files from Studio comments. Leave actionable comments pending and tell the user they will be handled in customize, unless the user explicitly asks to skip them.
   - During `onboard-customize`, default Studio comments to series-level customization. Comments about color, typography, visual density, layout feel, VTuber/avatar/logo/assets, tone, narration style, title style, card preference, recurring card behavior, pacing, or recurring defaults should patch `series-config.ts`, `SERIES_GUIDE.md`, shared assets, or series-scoped cards directly, then resolve the intent with evidence.
   - If a comment targets a demo card but describes how that card type should behave in the user's series (for example: "cover cards should be blue, include our logo, and remove the channel-name pill"), treat it as series template work. Split the request into the appropriate surfaces: theme/config changes, shared brand assets, `SERIES_GUIDE.md` card rules, and, when the built-in card cannot express the behavior, a series-scoped card override under `src/episodes/<activeSeries>/cards/<type>/` using the same `cardSpec.type`.
   - Only delegate to `/ars:apply-review <intent.id>` when the user explicitly says the issue is local to this demo card/step (for example "只修這張 demo") or the comment is clearly a factual/content bug in the demo episode.
   - During `onboard-verify`, handle only blocker comments or final review fixes that prevent onboarding completion; otherwise resolve/defer with a clear summary.
4. After any series-level change, tell the user to refresh the Studio tab and keep the monitor loop running.

Monitor rules:

- Drain pending intents whenever the watcher fires. Do not wait for the user to mention Studio comments in chat.
- Do not use `npx ars studio intent clear <id>` for applied preview/customize changes. Resolved intents should carry `resolution` evidence.
- Before leaving customize, run `npx ars studio intent list --pending --json` one more time and resolve every actionable intent so verify does not inherit stale preview comments.
- Keep the same monitor alive through verify unless the stage guard tells it to stop.

### Quick customize

1. Run the compact customize flow from `references/branding-guide.md`.
2. Start with one free-form prompt, not a questionnaire: ask the user to describe the channel, audience, desired vibe, visual references, and anything they definitely dislike in one paragraph or bullet list. Explicitly invite them to **paste a directory path or file paths** containing reference material (existing brand guide, sample scripts, screenshots, logo files, mood-board folder, prior episode transcripts) — read those files before asking follow-ups so the answers stay grounded in real material.
3. Use existing values from `.ars/config.json` and `series-config.ts` instead of re-asking them.
4. Ask follow-up questions only for missing fields that would otherwise force invention. Cap follow-ups at 3 before falling back to documented defaults.
5. Update `src/episodes/<activeSeries>/series-config.ts`. See `references/series-structure.md`.
6. Write `SERIES_GUIDE.md` using the basic sections of `references/series-guide-template.md`.
7. Every field must map to a user answer, an existing config value, or a documented minimal default.
8. Offer the deeper voice/card-preference pass. Run it only if the user opts in; append optional sections to the same `SERIES_GUIDE.md`.
9. Tell the user to refresh Studio and review the updated preview. If they leave Studio comments, address them before moving to verify.
10. Mention advanced extension points when relevant:
   - `shell.layout` can stay on built-in `'streaming'` / `'shorts'`, or advanced users can swap in a series custom layout component.
   - series-scoped cards under `src/episodes/<series>/cards/` can add new card types or override built-in engine cards by reusing the same `type`.

At the end, summarize:

- what changed in `series-config.ts`
- whether VTuber / theme / fonts were updated
- that `SERIES_GUIDE.md` now exists and will be read by later skills
- that the next step is verify

Then run:

```bash
npx ars workstate stamp --field customized
```

### Keep template for now

1. Do not run the customize interview.
2. Tell the user the initialized template remains usable.
3. Point them to the key files:
   - `series-config.ts`
   - `SERIES_GUIDE.md` if it exists
   - `public/episodes/<series>/shared/`
4. Frame this as a deferred customize state, not a fully customized brand.

Then run:

```bash
npx ars workstate stamp --field customized
```

### Advanced reset from scratch

Use this only after explicit confirmation. It can delete initialized template content.

1. Replace `src/episodes/<activeSeries>/` with a minimal series skeleton:
   - `series-config.ts`
   - `episode.template.ts`
   - no `ep-demo.ts`
   - no template custom cards unless the user asks to keep them
2. Create `public/episodes/<activeSeries>/shared/`.
3. Run the compact customize interview and write `SERIES_GUIDE.md`.
4. Tell the user the Studio `ep-demo` preview may no longer exist and point them to the next valid preview target.

Then run:

```bash
npx ars workstate stamp --field customized
```

## Optional Deep-Dive

After quick customize finishes, offer the deeper pass with this prompt:

```text
你的 SERIES_GUIDE 已生成（基本版）。

如果你願意再花 3-5 分鐘，我可以做一個「有靈魂版」補強。

接下來不會是長問卷。你可以直接用一段話描述：
- 你希望主持人講話像誰、不要像誰
- 有哪些常用語、禁用詞、結尾習慣
- 你偏好的卡片或視覺呈現
- 內容節奏要短平快，還是可以慢慢鋪陳

我會先整理，只有真的缺關鍵資訊才補問，最多 3 題。
要繼續嗎？(y / n / later)
```

Behavior by reply:

- `y` / `yes` / `好` / `繼續`: ask for one free-form deep-dive answer, summarize it, ask at most 3 targeted follow-ups only if needed, then append corresponding sections to `SERIES_GUIDE.md`.
- `n` / `no` / `跳過`: leave `SERIES_GUIDE.md` at basic version. Tell the user they can run `/ars:onboard` again later, edit the guide manually, or directly tell the agent what to change in `SERIES_GUIDE.md`.
- `later` / `稍後`: same as `n`, but explicitly mention this is recoverable.

When running the deeper pass, prefer free-form answers over enumerated questions. Drop sections the user skipped; never write empty placeholder sections.

## Confirmation Mode

Use this mode only when re-run detection shows `project.onboardedAt` is already set.

Do not offer destructive paths here. The series already has customizations.

Instead:

- summarize the current customized state (channel name, primary color, layout, VTuber status)
- ask whether they want to update branding now or leave it as-is
- if they want changes, run the quick customize flow against the existing files
- if `SERIES_GUIDE.md` lacks optional deep-dive sections, offer the optional deep-dive
- if they do not want changes, continue directly to verify

## Phase 3 — Verify

Stage name: `onboard-verify`

Verify is a **report card, not a gate**. Onboard's job is "user has seen the demo, set their brand, and seen the environment health report" — not "the environment is fully wired for every downstream feature." Provider credentials (MiniMax, YouTube) are needed only at audio/publish time; we surface gaps now so the user knows, but we do not block onboarding completion on them.

1. Write workstate with stage `onboard-verify`.
2. Run:

```bash
npx ars doctor
```

3. Classify the results into two buckets:

   **Structural fails (block onboard completion)** — the repo itself is broken and downstream skills cannot run:
   - `engine.*` (engine root / registry / template / Composition missing)
   - `plugin.*` (plugin manifest / hooks / skills missing)
   - `config.schema` failure
   - `config.active-series` fail (activeSeries set but series-config.ts missing)
   - `provider.speech-config` fail (speech.provider missing or invalid in series-config.ts)

   **Provider gaps (do NOT block onboard completion)** — the env is healthy but a future feature is unwired:
   - `provider.minimax` fail/warn (MiniMax enabled but missing API key / Group ID / voice)
   - `provider.youtube-credentials` fail (YouTube enabled but missing OAuth env)
   - `provider.audio-review` fail (review timing capability mismatch)

4. If any structural fail is present, do NOT stamp `onboardedAt`. Show the failing items with their `fixHint` and stop. The user must repair the repo (usually `npx ars init <series> --force-engine` or `--force-config`) before re-running `/ars:onboard`.

5. If only provider gaps are present (or everything passes), reframe the report. Do not paste raw doctor output. Group it into:
   - `Series context`
   - `Studio`
   - `Audio / TTS`
   - `YouTube publish`
   - `Analytics`

   For each non-pass item, say what is missing, why it matters, and the immediate next fix. Especially flag:
   - YouTube enabled but no auth → user needs `npx ars auth youtube` before `/ars:publish-youtube`
   - MiniMax enabled but no API key → user needs `MINIMAX_API_KEY` / `MINIMAX_GROUP_ID` in `.env` before `/ars:audio` or full `/ars:build` with audio
   - any non-MiniMax speech provider, because ARS beta audio support is MiniMax-only

6. **Conditional gating for explicitly-requested providers.** If the user actively opted in during `npx ars init` (i.e. `publish.youtube.enabled === true` in `.ars/config.json`, or `speech.enabled === true` in series-config.ts) AND that provider has a fail, ask before continuing:

   ```text
   你在 init 時開啟了 YouTube publishing / MiniMax audio，但目前還沒設好 credentials。
   要先補設嗎？

     1. 現在補設 — 我帶你跑 npx ars auth youtube / 設 .env，完成後再回來 verify
     2. 先跳過 — 我會記下 onboard 已完成，你要用到時 doctor 會再提醒
   ```

   - Choice 1: stay in verify; coach the user through the credential setup; re-run `npx ars doctor`; once the explicit-opt-in provider passes, fall through to step 7.
   - Choice 2: proceed to step 7. Do NOT toggle `publish.youtube.enabled` or `speech.enabled` back to false — leave the user's intent intact so doctor keeps reminding them later.

   If the user did NOT opt in (default `none` / `disabled`), skip this prompt entirely. Provider gaps in that case are expected and not actionable now.

7. Keep the Studio tab open during verify. If the user leaves preview comments while verify is running, handle them before closing onboard.

8. Stamp completion:

```bash
npx ars workstate clear --onboarded
```

This clears the workstate and stamps `project.onboardedAt` in `.ars/config.json`. Run this regardless of whether provider gaps remain — onboarding is "demo seen + brand set + report delivered", not "every credential wired."

9. Before the final handoff, run one last pending-intent drain. Then stop the background Studio intent monitor and stop the background `npx ars studio ...` process.

10. In the completion handoff:
    - Explicitly tell the user the onboard preview session is closed and the Studio tab can be closed.
    - If any provider gaps remain, restate the deferred items in one short list, with the exact command/file they need when the time comes (e.g. `MiniMax: add MINIMAX_API_KEY to .env before /ars:audio`). Frame these as deferred, not failures.
    - Tell the user `npx ars doctor` is the way to re-check at any time.

11. Suggest next steps:
    - `/ars:plan <topic>`
    - `/ars:build <epId>`

12. Remind the user that `SERIES_GUIDE.md` is not locked: at any time they can directly tell the agent to change tone, banned phrases, card preferences, pacing, or other series rules in `SERIES_GUIDE.md`.

## Phase Boundaries

- Phase 1 is demo walkthrough only — no file modifications.
- Phase 2 is series customization — brand, theme, voice, guide, and optional preview fixes.
- Phase 3 is verification only.
- There is no onboard setup phase. Repo setup belongs to `ars init <series>` before `/ars:onboard`.
