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
- Lets Claude Code generate optional YouTube analytics reports from the existing API helpers

## Requirements

- Node.js `>= 22.12.0`
- Claude Code CLI
- A repo where you want ARS installed

## Quick start

### 1. Install the CLI

```bash
npm install -g github:<owner>/<repo>
```

For local development of ARS itself:

```bash
git clone https://github.com/<owner>/<repo>
cd <repo>
npm install
npm link
```

### 2. Initialize your content repo

In a new directory for your channel:

```bash
npx ars init <series-name>
```

This bootstraps `.ars/config.json`, syncs the ARS engine, installs skills, and scaffolds your series from the template.

### 3. Launch Claude Code and onboard

```bash
ars
```

Then inside Claude Code:

```text
/ars:onboard
```

`/ars:onboard` is the official first-run entrypoint — it interviews you for brand, theme, VTuber preference, and visual direction, then writes the results into your series config.

### 4. Plan the first episode

Inside Claude Code:

```text
/ars:plan ep001
```

`/ars:plan` is the official episode planning entrypoint. It writes topic and plan artifacts under `.ars/episodes/ep001/` and decides whether custom cards are needed.

### 5. Build the episode

Inside Claude Code:

```text
/ars:build ep001
```

If the plan emitted `card-spec` todos, run `/ars:new-card` first and then come back to `/ars:build`.

### 6. Open review

Inside Claude Code:

```text
/ars:review ep001
```

Or directly from the terminal:

```bash
npx ars review open ep001
```

### 7. Apply review and polish

Inside Claude Code:

```text
/ars:apply-review latest
/ars:polish ep001
```

### 8. Prepare and publish to YouTube

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

### 9. Optional analytics report

Inside Claude Code:

```text
/ars:analytics --days 28
```

This skill uses the existing YouTube analytics helpers to produce a concise report under `.ars/analytics/`.

## Core skills

- `/ars:onboard`: interview + orchestration for first-run onboarding
- `/ars:plan`: official planning entrypoint for a new or existing episode
- `/ars:build`: implement `ep.ts` from the approved planning artifacts
- `/ars:episode-create`: low-level scaffold primitive for manual use
- `/ars:review`: launch the review surface
- `/ars:apply-review`: apply review intents back into the episode source
- `/ars:polish`: late-stage tier B refinement
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

- `npx ars init <series>` is the only first-run CLI entrypoint. It bootstraps the repo and creates the repo's only active series.
- `/ars:onboard` is the preferred first-run UX — it guides branding, theme direction, and visual style setup directly in series-config.ts.

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
