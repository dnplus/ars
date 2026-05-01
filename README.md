# ARS

Turn notes, sources, and episode ideas into publishable Remotion videos with Claude Code.

> 想先確認這工具是不是做給你的？先讀 [persona.md](./persona.md)。

ARS is a Claude Code-native workflow for planning, building, reviewing, preparing, and publishing YouTube episodes. It gives each series a repo, a reusable style guide, a Remotion engine, and a Studio surface for visual review.

## What ARS does

- Scaffolds a single-series episode repo around the ARS Remotion engine
- Lets Claude Code plan, build, review, and refine complete episodes
- Opens a Studio-first review surface that writes intents into `.ars/studio-intents/`
- Runs YouTube prepare through Studio/Claude Code intents and applies the selected result to episode `metadata.youtube`
- Packages and uploads finished episodes to YouTube
- Lets Claude Code generate optional YouTube analytics reports and reflect them back into the series guide

## Quick start

### 1. Install ARS from source

Clone this repo and link the local CLI:

```bash
git clone https://github.com/dnplus/ars.git
cd ars
npm install
npm link
```

### 2. Create a content repo

Create or open the repo where the series should live:

```bash
mkdir <series-repo>
cd <series-repo>
```

### 3. Launch Claude Code

In the content repo:

```bash
ars
```

`ars` launches Claude Code with the ARS plugin pre-loaded (`--plugin-dir`). If tmux is available, it opens in a managed tmux session.

### 4. Onboard

Inside Claude Code:

```text
/ars:onboard
```

`/ars:onboard` is the official first-run entrypoint. It walks you through a demo, collects your series name, TTS provider, and YouTube preference, initializes the repo if needed, then guides you through brand, theme, visual direction, and series speech setup.

On a completely empty content repo, `/ars:onboard` first asks for a series slug and runs the equivalent of `ars init <series-name> -y` so the template demo exists before Studio opens. After the walkthrough, onboarding continues into deterministic config, customization, and verification.

### 5. (Optional) Scripted init

If you want to initialize without the guided onboarding flow:

```bash
ars init <series-name>
```

That command handles the generated package setup for a fresh content repo:

- Creates `.ars/config.json` and writes `package.json` if missing
- Asks for TTS provider (`none` / `minimax`) and writes the choice to `series-config.ts`
- Runs `npm install` for you when generated scripts need dependencies
- Syncs the ARS Remotion engine into `src/engine/`
- Copies the template series into `src/episodes/<series-name>/`
- Patches `CLAUDE.md` with the ARS instructions block
- Installs plugin skills into `.claude/skills/ars/`
- Initializes git if the directory is not already a repo

Do **not** pre-run `npm init` in the content repo — `ars init` is the entrypoint, and it handles the generated package setup. Use `--skip-series` if you want the bootstrap without copying the template series, or `-y` to accept defaults non-interactively.

After it finishes you can run `/ars:onboard` to refine the series. Because `ars init` does not stamp `project.onboardedAt`, onboard still walks Phase 1 (demo walkthrough) and Phase 2 (deterministic bootstrap, which is a no-op when init already populated `.ars/config.json`) before reaching Phase 3 — the brand interview that writes `series-config.ts` and `SERIES_GUIDE.md`.

The published `npx -y agentic-remotion-studio init ...` path is not the recommended setup path yet. Use the source checkout + `npm link` flow above.

### 6. Plan the first episode

Inside Claude Code:

```text
/ars:plan ep001
```

`/ars:plan` is the official episode planning entrypoint. It writes topic and plan artifacts under `.ars/episodes/ep001/` and decides whether custom cards are needed.

### 7. Build the episode

Inside Claude Code:

```text
/ars:build ep001
```

`/ars:build` will handle any custom-card work recorded in the plan.

### 8. Open review

Inside Claude Code:

```text
/ars:review ep001
```

Or directly from the terminal:

```bash
ars studio ep001 --phase review
```

`ars review open ep001` still works as a legacy compatibility alias, but Studio is the primary shell.

Studio work is target-bound. When switching episodes, use `/ars:review <epId>` or `ars workstate switch <epId> --stage review` so Claude Code, monitors, and pending intents agree on the active episode.

### 9. Apply review and polish

Inside Claude Code:

```text
/ars:apply-review latest
/ars:polish ep001
```

### 10. Prepare and publish to YouTube

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

`ars prepare youtube <epId>` creates the deterministic prepare context. Candidate generation and selection should happen through `/ars:prepare-youtube` or Studio Prepare, which sends explicit `prepare-generate` / `prepare-select` Studio intents to Claude Code. The selected candidate must be written to the episode source as `metadata.youtube`; publish commands read only `metadata.youtube`.

### 11. Optional analytics and reflection

Inside Claude Code:

```text
/ars:analytics --days 28
/ars:reflect --days 28
```

`/ars:analytics` uses the existing YouTube analytics helpers to produce a concise report under `.ars/analytics/`.
`/ars:reflect` reads recent episodes plus analytics findings, writes a reflection memo under `.ars/reflect/`, and tightens `SERIES_GUIDE.md` when the evidence is strong enough.

## Requirements

- Node.js `>= 22.12.0`
- Claude Code CLI
- A repo where you want ARS installed
- MiniMax credentials if you want generated review audio
- YouTube OAuth credentials if you want to publish from ARS

## Core skills

- `/ars:onboard`: interview + orchestration for first-run onboarding
- `/ars:plan`: official planning entrypoint for a new or existing episode
- `/ars:build`: implement `ep.ts` from the approved planning artifacts
- `/ars:episode-create`: low-level scaffold primitive for manual use
- `/ars:review`: launch the Studio review phase
- `/ars:apply-review`: apply Studio intents, including review fixes, build triggers, and prepare metadata actions
- `/ars:polish`: late-stage tier B refinement
- `/ars:reflect`: turn recent episodes + analytics into series-level guide updates
- `/ars:prepare-youtube`: generate YouTube candidates, then apply the selected title, description, tags, and thumbnail/card guidance to episode metadata
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
- `ars studio <epId> --phase plan|build|review|slide`
- `ars workstate switch <epId> --stage <stage>`
- `ars audio ...`
- `ars export ...`
- `ars prepare youtube <epId>`
- `ars publish package <epId>`
- `ars publish youtube <epId>`
- `ars upload youtube <epId>`

Notes:

- `/ars:onboard` is the preferred first-run UX — it bootstraps the repo, guides branding and theme setup, and calls `ars init` when needed.
- `ars init <series>` is the low-level alternative for non-interactive or scripted setup.
- `ars update` upgrades an already-bootstrapped repo to the linked ARS source version: it backs up `src/engine/` to `.ars/backups/<timestamp>/engine` (last 3 retained), then refreshes engine, skills, agents, hook scripts, and version metadata. Run it after updating your source checkout. See `/ars:update` for usage and rollback steps.
- `ars review ...` remains as a legacy compatibility alias that forwards into Studio.
- `ars workstate switch <epId> --stage <stage>` is the explicit episode handoff command. It prevents Claude Code from accidentally handling pending intents for one episode while an IDE tab or status monitor points at another.
- Studio intents live in `.ars/studio-intents/`. Processed intents should keep resolution evidence; prefer `ars studio intent resolve <id> ...` over clearing files silently.
- MiniMax is the only built-in TTS provider supported in this beta release. If you configure `elevenlabs`, doctor will fail and audio generation will stop.

## One repo = one series

ARS core assumes each content repo has exactly one active series, set during `ars init <series>` or `/ars:onboard`. All episode commands take `epId` only — the active series is resolved automatically from `.ars/config.json`.

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

## Product boundary

- Primary surface: Claude Code skills
- Backend surface: `ars ...` from the linked source checkout
- Supported repo model: one repo = one series
- Supported review shell in core: Studio (`ars studio`)
- Supported TTS in core: MiniMax only (beta)
- Supported publish surface in core: YouTube only
- Deprecated and removed from core: repo-local `/ars-review`, social publish flows, production `pipeline`

ARS is plugin-first: Claude Code skills own the user-facing workflow. The CLI is the deterministic backend for install, scaffolding, review launch, asset preparation, export, and YouTube upload.

## Acknowledgements

ARS was shaped in part by ideas explored in [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), while focusing on a different product surface: creator-first Remotion episode workflows.
