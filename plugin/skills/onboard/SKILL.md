---
name: ars:onboard
description: Four-phase ARS onboarding — walkthrough, bootstrap, customize, verify.
model: claude-sonnet-4-6
effort: medium
---

`/ars:onboard` follows a strict 4-phase onboarding flow.

## Prereq / install

If `/ars:onboard` is being invoked inside Claude Code, the repo has already been bootstrapped — skip this section.

If a user is asking how to start ARS from zero (no `.ars/config.json`, no `src/engine/`, possibly no `package.json`), the canonical one-step entry is:

```bash
npx -y agentic-remotion-studio init <series-name>
```

That single command handles everything: it runs `npm install` when needed, syncs `src/engine/`, copies the template series into `src/episodes/<series-name>/`, patches `CLAUDE.md`, installs plugin skills into `.claude/skills/ars/`, writes `.ars/config.json`, and `git init`s the repo if needed.

Do **not** instruct the user to pre-run `npm init`, install the npm tarball manually, or `git clone` the ARS repo before init. `npx -y agentic-remotion-studio init` is the entrypoint. After it finishes, the user runs `ars` (or `npx ars`) to launch Claude Code, then types `/ars:onboard` to enter Phase 1 below.

Use `--skip-series` if the user wants the bootstrap without copying the template series, and `-y` to accept defaults non-interactively.

## Phase transitions

At each phase transition, advance the workstate stage using:

```bash
npx ars workstate set --stage <stage-name>
```

This ensures the correct schema version and timestamp.

## Output contract

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

Keep the tone concrete and operational. Prefer:

- `You are now in Phase 1 walkthrough: this is a demo-only pass to understand the workflow. It will not modify your series files.`
- `Once this phase is done, the next step is bootstrap: set up the deterministic config (series name, TTS, YouTube).`
- `The goal of verify is to make sure this repo is actually ready for the first real episode.`

Avoid:

- long architecture explanations
- dumping shell output without interpretation
- saying only `done` / `pass` without telling the user what that means

## Re-run detection

**Do this before any workstate write or phase action.**

Read `.ars/config.json` and check `project.customizedAt` and `project.onboardedAt`. Two fields exist on purpose:

- `customizedAt` is stamped at the end of Phase 3, so a Phase 4 verify failure (e.g. missing MiniMax key) does not lose the brand-interview work.
- `onboardedAt` is stamped only after Phase 4 verify passes — it is the SSOT the statusline reads to mark onboarding complete.

Re-run logic:

- If **neither** is set → first onboard run, proceed normally from Phase 1.
- If `customizedAt` is set but `onboardedAt` is not → Phase 3 already ran but Phase 4 verify never finished. Skip Phase 1 and Phase 2, write workstate `onboard-verify`, and resume directly at Phase 4 (the user wants to clear the verify failure that blocked the previous run).
- If `onboardedAt` is set → onboard already completed; **skip Phase 1 and Phase 2 entirely**, write workstate `onboard-customize`, enter Phase 3 confirmation mode, then continue to Phase 4 normally.

## Phase 1 — walkthrough

**Skip this entire phase if re-run detection determined the series is already customized. Go directly to Phase 3 confirmation mode.**

Stage name: `onboard-walkthrough`

1. Write workstate with stage `onboard-walkthrough`
2. Give a 2-3 sentence intro to ARS
3. Open the Studio in the background and do not wait for it to finish:

```bash
npx ars studio ep-demo --phase review
```

   Keep the process handle / terminal session for this background Studio launch. Onboard must explicitly stop this Studio process when the flow ends or is aborted.

4. Immediately after launching, tell the user:
   - they are currently in **Phase 1 walkthrough**
   - this phase is **demo only** and will not modify their files
   - Watch the output for the localhost URL (e.g. `http://localhost:5174`) and share it
   - Keep the Studio tab open; onboard should reuse this same Studio session through bootstrap, customize and verify
   - Browse the demo, then say **`next`** to continue to Phase 2 bootstrap, or **`skip`** to skip the walkthrough

## Phase 2 — bootstrap

Stage name: `onboard-bootstrap`

Bootstrap handles **deterministic settings only** — things that don't require creative input.

1. Write workstate with stage `onboard-bootstrap`
2. Tell the user: this phase collects basic config (series name, TTS provider, YouTube). No creative decisions yet.
3. If `.ars/config.json` is missing or has no `project.activeSeries`, ask for a **series name** (channel slug, lowercase, no spaces) and **remember it for Phase 3**. Do NOT pass it to the bootstrap call — `--skip-series` and a series-name argument are mutually exclusive in `npx ars init` and the CLI will refuse.

   Run the bootstrap as:

   ```bash
   npx ars init --skip-series -y
   ```

   This initializes the repo (sync engine, patch CLAUDE.md, install skills) without copying the template series. `project.activeSeries` stays unset on purpose — it is written in Phase 3 when the series content is actually created (`npx ars init <series>` for "from template" / "do it later", or direct file scaffolding for "from scratch").

4. Confirm **TTS provider** (minimax / none). If minimax, remind about `.env` keys (`MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`).
5. Confirm **YouTube publishing** (enabled / disabled). If enabled, remind about credential files.
6. Write confirmed values to `.ars/config.json` using direct file edit (the config schema is documented in `cli/lib/ars-config.ts`).

**Do NOT copy the template series here. Do NOT ask about theme, tone, or VTuber. Those belong in Phase 3.**

End with handoff: bootstrap is done, config is written, next step is customize where the series content gets created.

## Phase 3 — customize

Stage name: `onboard-customize`

1. Write workstate with stage `onboard-customize`
2. Ask the user to pick one of three modes:

   - **from template** — copy the template series as a starting point, then run a brand interview
   - **from scratch** — create a minimal series skeleton (series-config.ts + empty episode dir) without template content
   - **do it later** — copy the template series as-is (so the repo is immediately usable), skip the brand interview, come back later

When presenting the three modes, explain the outcome of each one in one sentence:

- `from template` copies the demo content as a working reference, then writes the new series identity on top
- `from scratch` creates a clean series skeleton without demo episodes or cards
- `do it later` copies the template as-is so you can start immediately, and you can customize later

Before the interview begins, align Studio with the current series:

- If `project.activeSeries` is already set, tell the user to switch the still-open Studio tab to `?series=<activeSeries>&ep=ep-demo&phase=review` and keep it open during customize.
- During customize, treat Studio as the live preview surface. Ask the user to leave comments/feedback there if they want visual tweaks while branding changes are being applied.

Once the Phase 3 preview target is ready, start a Studio intent monitor in the background, using the same event-driven pattern as `/ars:review`:

```bash
node -e "
const fs = require('fs');
const dir = '.ars/studio-intents';
fs.watch(dir, (event, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(filename);
  }
});
process.stdout.write('watching\n');
"
```

Each stdout line is a notification. On every notification:

1. **Stage guard**: Check `.ars/state/workstate.json`. If the current stage is neither `onboard-customize` nor `onboard-verify`, stop the monitor loop.
2. Run `npx ars studio intent list --pending --json`.
3. For each pending intent targeting the active preview episode:
   - If it is a step-scoped preview fix, delegate to `/ars:apply-review <intent.id>` so the preview updates immediately.
   - If it is a series-level branding/default request (theme, VTuber, copy defaults, SERIES_GUIDE guidance), patch the owning files directly (`series-config.ts`, `SERIES_GUIDE.md`, shared assets when needed), then run `npx ars studio intent clear <intent.id>`.
4. After any series-level change, tell the user to refresh the still-open Studio tab and keep the monitor loop running.

Monitor rules:

- The monitor is proactive. Do not wait for the user to mention Studio comments in chat; drain pending intents whenever the watcher fires.
- Before leaving Phase 3 customize, run `npx ars studio intent list --pending --json` one more time and clear the queue so verify does not inherit stale preview comments.
- Keep the same monitor alive through Phase 4 verify unless the stage guard tells it to stop.

### from template

1. Run `npx ars init <series>` (without `--skip-series`) to copy the template series
2. Run **Stage 1** of the brand interview — see `references/branding-guide.md` (visual identity AND series identity — audience, mission, tone, length, CTA). Do NOT skip the series identity questions; they drive SERIES_GUIDE.md.
3. Update `series-config.ts` — see `references/series-structure.md` for the full file structure and key fields
4. Write `SERIES_GUIDE.md` at repo root using the **basic sections** of `references/series-guide-template.md`. **Every field must map to an interview answer, an existing config value, or a documented minimal default.** If the user said "reuse defaults" for series identity questions, use the minimal defaults verbatim and announce which defaults were applied. Never infer audience/mission/takeaway from the channel name.
5. **Offer Stage 2 voice deep-dive** (see `## Stage 2 voice deep-dive` below). Run it if the user opts in; append the optional sections to the same `SERIES_GUIDE.md`.
6. Once the edits are in place, tell the user to refresh the still-open Studio tab and review the updated preview; if they leave Studio comments, address them before moving to Phase 4
7. Mention the advanced extension points when relevant:
   - `shell.layout` can stay on built-in `'streaming'` / `'shorts'`, or advanced users can swap in a series custom layout component
   - series-scoped cards under `src/episodes/<series>/cards/` can add new card types or override built-in engine cards by reusing the same `type`
8. Add optional custom skills if the user wants them

At the end of this path, summarize the concrete outputs:

- what changed in `series-config.ts`
- whether VTuber / theme / fonts were updated
- that `SERIES_GUIDE.md` now exists and will be read by later skills
- that the next step is Phase 4 verify

Then run:

```bash
npx ars workstate stamp --field customized
```

This stamps `project.customizedAt` so a later Phase 4 verify failure (e.g. missing MiniMax keys) does not lose the brand-interview work — re-running `/ars:onboard` will resume directly at Phase 4 instead of restarting from Phase 1.

### from scratch

1. Create minimal series directory at `src/episodes/<series>/`:
   - Create `series-config.ts` with default theme and episode defaults (use `references/series-structure.md` as reference)
   - Create `episode.template.ts` (the boilerplate for new episodes)
   - Do NOT copy `ep-demo.ts` or `cards/`
2. Create `public/episodes/<series>/shared/` directory
3. Set active series in `.ars/config.json`
4. Run the same Stage 1 brand interview and write SERIES_GUIDE.md basic sections as in "from template"
5. Offer Stage 2 voice deep-dive (see `## Stage 2 voice deep-dive` below); append to SERIES_GUIDE.md if the user opts in
6. After writing the new series defaults, tell the user the existing Studio tab may no longer have `ep-demo`; point them at the next valid preview target if needed

At the end of this path, explicitly say that a clean series skeleton was created (no demo content), and the next step is Phase 4 verify.

Then run:

```bash
npx ars workstate stamp --field customized
```

This stamps `project.customizedAt` so a later Phase 4 verify failure does not force the user to redo the brand interview on the next `/ars:onboard` run.

### do it later

1. Run `npx ars init <series>` (without `--skip-series`) to copy the full template series — this ensures the repo is immediately usable
2. Skip the brand interview entirely
3. Tell the user:
   - 「之後跑 `/ars:onboard` 可以隨時回來客製化」
   - 「或直接告訴我你想改什麼（頻道名、配色、風格），我就知道要改哪些檔案」
4. Point them to the key files:
   - `series-config.ts` (brand + theme)
   - `SERIES_GUIDE.md` (series background knowledge, tone, and structure defaults)
   - `public/episodes/<series>/shared/vtuber/` (VTuber images)

Frame this as a deferred customize state, not a completed customize state.

Then run:

```bash
npx ars workstate stamp --field customized
```

Even though branding is deferred, stamping `customizedAt` records that Phase 3 was reached on purpose. A subsequent Phase 4 verify failure does not push the user back to the Phase 1 walkthrough on re-run.

## Stage 2 voice deep-dive

After Stage 1 finishes (basic SERIES_GUIDE.md is written), offer Stage 2 with this prompt:

```
你的 SERIES_GUIDE 已生成（基本版）。

如果你願意再花 5 分鐘把語氣、用詞、卡片偏好設下來，我可以把
SERIES_GUIDE 補成「有靈魂版」——包含 slogan、常用開場、禁用詞、
卡片選擇優先序、對照範例。

這對未來 /ars:build 的產出品質影響很大，因為 build 會直接讀
SERIES_GUIDE 來決定 narration 風格、卡片選型和 step 長度。

要繼續嗎？(y / n / later)
```

Behavior by reply:
- `y` / `yes` / `好` / `繼續` → run the Stage 2 question set in `references/branding-guide.md` (the `Stage 2 — voice deep-dive` section), then append the corresponding sections to `SERIES_GUIDE.md`.
- `n` / `no` / `跳過` → leave SERIES_GUIDE at basic version, move on. Tell the user they can run `/ars:onboard` again later or edit SERIES_GUIDE manually.
- `later` / `稍後` → same as `n` but explicitly mention this is recoverable.

When running Stage 2, ask **one question at a time**, same as Stage 1. Accept short answers, accept "skip" per question. After all answers come in, append these sections to SERIES_GUIDE.md (drop sections the user skipped):

```markdown
## Slogan & Persona
## Common Openers
## Signature Sign-off
## Banned Phrases & Replacements
## Card Preferences (Authoring Heuristics)
## Step Duration Cap
## Contrast Examples
```

After writing, tell the user which sections were added and that `/ars:build` will now follow the stricter voice rules.

## Phase 3 confirmation mode

Use this mode only when re-run detection shows `project.onboardedAt` is already set (the previous onboard finished cleanly). If only `project.customizedAt` is set without `onboardedAt`, re-run detection sends the flow directly to Phase 4 instead — Phase 3 should not run again, the user already finished it.

Do NOT offer the three-way choice here — the series already has customizations. Destroying them (especially via "from scratch") would lose user work.

Instead:
- summarize the current customized state (channel name, primary color, layout, VTuber status, etc.)
- ask whether they want to update branding now or leave it as-is
- if they want changes, run the brand interview from `references/branding-guide.md` against the existing files (never delete `ep-demo.ts` / `cards/` in this mode)
- check whether `SERIES_GUIDE.md` already has Stage 2 sections (`## Slogan & Persona`, `## Banned Phrases & Replacements`, `## Contrast Examples`, etc.). If not, offer Stage 2 voice deep-dive — same prompt as the first-time flow. This is the typical re-run reason for users who originally skipped Stage 2.
- if they do not want changes, continue directly to Phase 4

Make the summary concrete. Mention current artifacts and settings, not generic phrases like `already customized`.

## Phase 4 — verify

Stage name: `onboard-verify`

1. Write workstate with stage `onboard-verify`
2. Run:

```bash
npx ars doctor
```

3. Surface every `fail` result together with its `fixHint`
4. Especially flag:
- YouTube enabled but no auth
- MiniMax selected but no API key
- Any non-MiniMax speech provider — ARS beta audio support is MiniMax-only
5. Keep the Studio tab open during verify as well. If the user leaves preview comments while verify is running, handle them before closing onboard.
6. If all checks pass, run `npx ars workstate clear --onboarded` — this clears the workstate AND stamps `project.onboardedAt` in `.ars/config.json`, which is the SSOT telling the statusline that onboard is complete
7. Before the final handoff, do a last `npx ars studio intent list --pending --json` drain. Then stop the background Studio intent monitor and stop the background `npx ars studio ...` process that onboard launched. Do not leave either one running after onboard ends.
8. In the completion handoff, explicitly tell the user that the onboard preview session is closed and the Studio tab can be closed.
9. Output next-step suggestions:
- `/ars:plan <topic>`
- `/ars:build <epId>`

Do not just paste raw doctor output. Reframe it into a readiness summary:

- `Series context`
- `Studio`
- `Audio / TTS`
- `YouTube publish`
- `Analytics`

For each failed item, say:

- what is missing
- why it matters
- the immediate next fix

If all checks pass, close with a completion handoff similar to:

- `Onboarding is complete: series context, config, and provider readiness are all in place.`
- `Studio comment monitor stopped, onboarding preview closed.`
- `Next step: start from /ars:plan <topic>, or continue an existing idea with /ars:build <epId>.`

## Phase boundaries

Keep the phases separate:
- Phase 1 is demo walkthrough only — no file modifications
- Phase 2 is deterministic config only — series name, TTS, YouTube
- Phase 3 is series creation and branding customization
- Phase 4 is verification only
