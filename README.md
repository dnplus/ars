# ARS

Stop spending weekends on slides and timelines. ARS turns your notes into publishable Remotion episodes — fully agentic.

> 想先確認這工具是不是做給你的？先讀 [persona.md](./persona.md)。

ARS is a Claude Code plugin-first workflow for building Remotion-based video episodes. The plugin owns the user-facing workflow. The CLI is the deterministic backend for install, scaffolding, review launch, asset preparation, export, and YouTube upload.

## Acknowledgements

ARS was shaped in part by ideas explored in [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), while focusing on a different product surface: creator-first Remotion episode workflows.

## Product boundary

- Primary surface: Claude Code skills
- Backend surface: `npx ars ...`
- Supported repo model: one repo = one series
- Supported review shell in core: Studio (`ars studio`)
- Supported TTS in core: MiniMax only (beta)
- Supported publish surface in core: YouTube only
- Deprecated and removed from core: repo-local `/ars-review`, social publish flows, production `pipeline`

## What ARS does

- Scaffolds a single-series episode repo around the ARS Remotion engine
- Lets Claude Code plan, build, review, and refine complete episodes
- Opens a Studio-first review surface that writes intents into `.ars/studio-intents/`
- Prepares YouTube metadata artifacts for human review
- Packages and uploads finished episodes to YouTube
- Lets Claude Code generate optional YouTube analytics reports and reflect them back into the series guide

## Requirements

- Node.js `>= 22.12.0`
- Claude Code CLI
- A repo where you want ARS installed
- MiniMax credentials if you want generated review audio
- YouTube OAuth credentials if you want to publish from ARS

## Quick start

### 1. Bootstrap a new repo (one step)

In an empty directory where you want the series to live:

```bash
npx -y agentic-remotion-studio init <series-name>
```

That single command does everything a fresh repo needs:

- Creates `.ars/config.json` and writes `package.json` if missing
- Runs `npm install` for you when generated scripts need dependencies
- Syncs the ARS Remotion engine into `src/engine/`
- Copies the template series into `src/episodes/<series-name>/`
- Patches `CLAUDE.md` with the ARS instructions block
- Installs plugin skills into `.claude/skills/ars/`
- Initializes git if the directory is not already a repo

Do **not** pre-run `npm init` or install the package yourself — `npx -y agentic-remotion-studio init` is the entrypoint, and it handles all of that. Use `--skip-series` if you want the bootstrap without copying the template series, or `-y` to accept defaults non-interactively.

If you want the `ars` command in PATH afterwards:

```bash
npm install -g agentic-remotion-studio
```

For local development of ARS itself:

```bash
git clone https://github.com/dnplus/ars.git
cd <repo>
npm install
npm link
```

### 2. Launch Claude Code

In your content repo directory:

```bash
ars
```

`ars` launches Claude Code with the ARS plugin pre-loaded (`--plugin-dir`). If tmux is available, it opens in a managed tmux session.

If you're working from a linked local checkout, `npx ars` from that checkout also works.

### 3. Onboard

Inside Claude Code:

```text
/ars:onboard
```

`/ars:onboard` is the official first-run entrypoint. It walks you through a demo, collects your series name and YouTube preference, initializes the repo if needed, then guides you through brand, theme, visual direction, and series speech setup.

### 4. (Optional) Manual init

If you skipped step 1 and want to initialize without the guided onboarding flow:

```bash
npx ars init <series-name>
```

Same behavior as `npx -y agentic-remotion-studio init` (see step 1). The interactive prompt collects YouTube enable/disable, channel name, and shell layout, then copies the template series and writes `project.activeSeries`.

After it finishes you can run `/ars:onboard` to refine the series. Because `npx ars init` does not stamp `project.onboardedAt`, onboard still walks Phase 1 (demo walkthrough) and Phase 2 (deterministic bootstrap, which is a no-op when init already populated `.ars/config.json`) before reaching Phase 3 — the brand interview that writes `series-config.ts` and `SERIES_GUIDE.md`. If you want to skip straight to brand customization, edit `.ars/config.json` to set `project.onboardedAt` to the current ISO timestamp; onboard will then enter Phase 3 confirmation mode on the next run.

### 5. Plan the first episode

Inside Claude Code:

```text
/ars:plan ep001
```

`/ars:plan` is the official episode planning entrypoint. It writes topic and plan artifacts under `.ars/episodes/ep001/` and decides whether custom cards are needed.

### 6. Build the episode

Inside Claude Code:

```text
/ars:build ep001
```

`/ars:build` will handle any custom-card work recorded in the plan.

### 7. Open review

Inside Claude Code:

```text
/ars:review ep001
```

Or directly from the terminal:

```bash
ars studio ep001 --phase review
```

`ars review open ep001` still works as a legacy compatibility alias, but Studio is the primary shell.

### 8. Apply review and polish

Inside Claude Code:

```text
/ars:apply-review latest
/ars:polish ep001
```

### 9. Prepare and publish to YouTube

Inside Claude Code:

```text
/ars:prepare-youtube ep001
/ars:publish-youtube ep001
```

Or directly from the terminal:

```bash
ars prepare youtube ep001
ars publish youtube ep001 --privacy private
```

### 10. Optional analytics and reflection

Inside Claude Code:

```text
/ars:analytics --days 28
/ars:reflect --days 28
```

`/ars:analytics` uses the existing YouTube analytics helpers to produce a concise report under `.ars/analytics/`.
`/ars:reflect` reads recent episodes plus analytics findings, writes a reflection memo under `.ars/reflect/`, and tightens `SERIES_GUIDE.md` when the evidence is strong enough.

## Core skills

- `/ars:onboard`: interview + orchestration for first-run onboarding
- `/ars:plan`: official planning entrypoint for a new or existing episode
- `/ars:build`: implement `ep.ts` from the approved planning artifacts
- `/ars:episode-create`: low-level scaffold primitive for manual use
- `/ars:review`: launch the Studio review phase
- `/ars:apply-review`: apply review intents back into the episode source
- `/ars:polish`: late-stage tier B refinement
- `/ars:reflect`: turn recent episodes + analytics into series-level guide updates
- `/ars:prepare-youtube`: fill the prepare artifact with title, description, and tags
- `/ars:publish-youtube`: confirmed YouTube publish flow
- `/ars:analytics`: optional Claude Code report for recent YouTube channel performance
- `/ars:update`: refresh engine, skills, agents, and hook scripts from the installed ARS package, with timestamped backups and rollback instructions

## CLI surface

Stable backend commands:

- `ars update`
- `ars doctor`
- `ars init <series>`
- `ars card list [--json]`
- `ars episode ...`
- `ars studio <epId> --phase plan|build|review`
- `ars audio ...`
- `ars export ...`
- `ars prepare youtube <epId>`
- `ars publish package <epId>`
- `ars publish youtube <epId>`
- `ars upload youtube <epId>`

Notes:

- `/ars:onboard` is the preferred first-run UX — it bootstraps the repo, guides branding and theme setup, and calls `npx ars init` when needed.
- `npx ars init <series>` is the low-level alternative for non-interactive or scripted setup.
- `npx ars update` upgrades an already-bootstrapped repo to the installed ARS package version: it backs up `src/engine/` to `.ars/backups/<timestamp>/engine` (last 3 retained), then refreshes engine, skills, agents, hook scripts, and version metadata. Run it after `npm i agentic-remotion-studio@latest`. See `/ars:update` for usage and rollback steps.
- `ars review ...` remains as a legacy compatibility alias that forwards into Studio.
- MiniMax is the only built-in TTS provider supported in this beta release. If you configure `elevenlabs`, doctor will fail and audio generation will stop.

## One repo = one series

ARS core assumes each content repo has exactly one active series, set during `npx ars init <series>` or `/ars:onboard`. All episode commands take `epId` only — the active series is resolved automatically from `.ars/config.json`.

## Current core scope

Included:

- install / sync
- one-series repo scaffold
- episode scaffolding
- review loop
- YouTube prepare
- YouTube publish

Not in ARS core:

- social publishing
- old `pipeline`
- repo-local slash command duplication

If you need social distribution or multi-platform release orchestration, build that as an extension instead of relying on ARS core.
