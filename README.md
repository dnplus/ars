# ARS

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
npm install -g agentic-remotion-studio
```

For local development:

```bash
npm install
npm link
```

### 2. Launch Claude Code with the ARS plugin

From your content repo:

```bash
ars
```

Bare `ars` launches Claude Code with the bundled ARS plugin attached.

### 3. Run plugin-first onboarding

Inside Claude Code:

```text
/ars:setup
```

`/ars:setup` is the official first-run entrypoint. It should:

- interview you for series id, brand, visual direction, tone, mascot / VTuber preference, and layout bias
- run `npx ars setup`
- run `npx ars init <series>`
- generate a theme seed
- write repo-level branding defaults into `.ars/config.json`
- leave `src/episodes/<series>/series-config.ts` ready for the first episode

### 4. Plan the first episode

Inside Claude Code:

```text
/ars:plan ep001
```

`/ars:plan` is the official episode planning entrypoint. It should:

- ensure the episode scaffold exists
- write `.ars/episodes/ep001/topic.md`
- write `.ars/episodes/ep001/plan.md`
- write `.ars/episodes/ep001/todo.json`
- inspect built-in cards and `src/episodes/<series>/cards/*/spec.ts` before planning a new custom card
- emit `card-specs/` only if neither built-in cards nor existing series-scoped custom cards are sufficient

### 5. Build the episode

Inside Claude Code:

```text
/ars:build ep001
```

If the plan emitted `card-spec` todos, run `/ars:new-card` first and then come back to `/ars:build`.

### 6. Open review

Inside Claude Code:

```text
/ars:review-open ep001
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

- `/ars:setup`: interview + orchestration for first-run onboarding
- `/ars:plan`: official planning entrypoint for a new or existing episode
- `/ars:build`: implement `ep.ts` from the approved planning artifacts
- `/ars:episode-create`: low-level scaffold primitive for manual use
- `/ars:review-open`: launch the review surface
- `/ars:apply-review`: apply review intents back into the episode source
- `/ars:polish`: late-stage tier B refinement
- `/ars:prepare-youtube`: fill the prepare artifact with title, description, and tags
- `/ars:publish-youtube`: confirmed YouTube publish flow
- `/ars:analytics`: optional Claude Code report for recent YouTube channel performance

## CLI surface

Stable backend commands:

- `npx ars setup`
- `npx ars update`
- `npx ars doctor`
- `npx ars init <series>`
- `npx ars episode ...`
- `npx ars review ...`
- `npx ars audio ...`
- `npx ars theme ...`
- `npx ars export ...`
- `npx ars prepare youtube <epId>`
- `npx ars publish package <epId>`
- `npx ars publish youtube <epId>`
- `npx ars upload youtube <epId>`

Notes:

- `npx ars setup` is a low-level install/sync primitive. It is not the preferred first-run user experience.
- `npx ars init <series>` is an advanced/internal scaffold primitive. It should only happen once per repo.

## One repo = one series

ARS core now assumes each content repo has exactly one active series. That state lives in `.ars/config.json`.

Relevant config shape:

```json
{
  "version": 2,
  "project": {
    "activeSeries": "demo-series",
    "channelName": "My Channel",
    "visualDirection": "clean explanatory visuals",
    "tone": "direct and practical",
    "mascot": "minimal host",
    "visualDensity": "balanced",
    "layoutBias": "mixed"
  },
  "tts": {
    "provider": "none"
  },
  "publish": {
    "youtube": {
      "enabled": true
    }
  },
  "review": {
    "preferredUi": "studio"
  }
}
```

After setup, user-facing commands should usually take `epId` only:

```bash
npx ars episode create ep001
npx ars audio generate ep001
npx ars review open ep001
npx ars prepare youtube ep001
npx ars publish youtube ep001
```

`<series>/<epId>` still works as a compatibility path in some commands, but it is no longer the primary documented interface.

## Episode schema

Episodes should follow the current template shape in [`src/episodes/template/episode.template.ts`](./src/episodes/template/episode.template.ts).

Example:

```ts
import { Episode } from "../../engine/shared/types";

export const ep001: Episode = {
  metadata: {
    title: 'Episode Title',
    subtitle: 'Episode Subtitle',
    episodeTag: 'EP1 · Intro',
  },
  steps: [
    {
      id: 'intro',
      contentType: 'cover',
      animation: 'matrix',
      narration: '開場旁白...',
      durationInSeconds: 10,
    },
    {
      id: 'content_1',
      contentType: 'text',
      title: '內容標題',
      description: '內容描述',
      cardTitle: '卡片標題',
      cardContent: '卡片內容\\n• 第一點\\n• 第二點',
      narration: '旁白內容...',
      durationInSeconds: 15,
    },
    {
      id: 'outro',
      contentType: 'summary',
      title: '總結',
      description: '感謝觀看',
      summaryPoints: ['重點總結'],
      narration: '結尾旁白...',
      durationInSeconds: 8,
    },
  ],
};
```

`shell` is usually injected from `src/episodes/<series>/series-config.ts`, so episode files do not need to hand-define it unless they are intentionally overriding the series default.

## Planning artifacts

ARS planning artifacts live under `.ars/episodes/<epId>/`.

Expected files:

- `topic.md`: discussion summary, audience, thesis, constraints, and open questions
- `plan.md`: canonical build contract for the episode
- `todo.json`: tracked execution state across planning, optional card work, build, and completion
- `card-specs/<card-name>.md`: optional custom card briefs when the plan requires new cards

The normal authoring flow is:

```text
/ars:plan ep001
/ars:new-card ...   # only when plan emits card-spec todos
/ars:build ep001
/ars:review-open ep001
/ars:apply-review latest
/ars:polish ep001
```

## Manual backend flows

### Validate install

```bash
npx ars doctor
```

### Create a series manually

```bash
npx ars setup
npx ars init demo-series
```

### Review intents

```bash
npx ars review intent list
npx ars review intent show <intent-id>
npx ars review intent clear <intent-id>
```

### Package without uploading

```bash
npx ars publish package ep001
```

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
