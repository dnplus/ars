# ARS

Stop spending weekends on slides and timelines. ARS turns your notes into publishable Remotion episodes — fully agentic.

ARS is a Claude Code plugin-first workflow for building Remotion-based video episodes. The plugin owns the user-facing workflow. The CLI is the deterministic backend for install, scaffolding, review launch, asset preparation, export, and YouTube upload.

## Product boundary

- Primary surface: Claude Code skills
- Backend surface: `npx ars ...`
- Supported repo model: one repo = one series
- Supported publish surface in core: YouTube only
- Deprecated and removed from core: repo-local `/ars-review`, social publish flows, production `pipeline`

## What ARS does

- Scaffolds a single-series episode repo around the ARS Remotion engine
- Lets Claude Code plan, build, review, and refine complete episodes
- Opens a local review surface that writes review intents into `.ars/review-intents/`
- Prepares YouTube metadata artifacts for human review
- Packages and uploads finished episodes to YouTube
- Lets Claude Code generate optional YouTube analytics reports and reflect them back into the series guide

## Requirements

- Node.js `>= 22.12.0`
- Claude Code CLI
- A repo where you want ARS installed

## Quick start

### 1. Install the CLI

For local development of ARS itself:

```bash
git clone https://github.com/<owner>/<repo>
cd <repo>
npm install
npm link
```

### 2. Launch Claude Code

In your content repo directory:

```bash
npx ars
```

`npx ars` launches Claude Code with the ARS plugin pre-loaded (`--plugin-dir`). If tmux is available, it opens in a managed tmux session.

### 3. Onboard

Inside Claude Code:

```text
/ars:onboard
```

`/ars:onboard` is the official first-run entrypoint. It walks you through a demo, collects your series name, TTS provider, and YouTube preference, initializes the repo if needed, then guides you through brand, theme, and visual direction setup.

### 4. (Optional) Manual init

If you prefer to initialize without the guided flow:

```bash
npx ars init <series-name>
```

This bootstraps `.ars/config.json`, syncs the ARS engine, installs skills, and scaffolds your series from the template. Then run `/ars:onboard` to fill in brand and theme settings.

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
npx ars review open ep001
```

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
npx ars prepare youtube ep001
npx ars publish youtube ep001 --privacy private
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
- `/ars:review`: launch the review surface
- `/ars:apply-review`: apply review intents back into the episode source
- `/ars:polish`: late-stage tier B refinement
- `/ars:reflect`: turn recent episodes + analytics into series-level guide updates
- `/ars:prepare-youtube`: fill the prepare artifact with title, description, and tags
- `/ars:publish-youtube`: confirmed YouTube publish flow
- `/ars:analytics`: optional Claude Code report for recent YouTube channel performance

## CLI surface

Stable backend commands:

- `npx ars update`
- `npx ars doctor`
- `npx ars init <series>`
- `npx ars card list [--json]`
- `npx ars episode ...`
- `npx ars review ...`
- `npx ars audio ...`
- `npx ars export ...`
- `npx ars prepare youtube <epId>`
- `npx ars publish package <epId>`
- `npx ars publish youtube <epId>`
- `npx ars upload youtube <epId>`

Notes:

- `/ars:onboard` is the preferred first-run UX — it bootstraps the repo, guides branding and theme setup, and calls `npx ars init` when needed.
- `npx ars init <series>` is the low-level alternative for non-interactive or scripted setup.

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
