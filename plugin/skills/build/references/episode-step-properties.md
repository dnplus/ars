# Episode Step Properties Reference

Each step in `ep.ts` is an object with a `contentType` that determines which card renders.

## Episode file structure

```typescript
import { Episode } from "../../engine/shared/types";
import { SERIES_CONFIG } from "./series-config";

export const ep001: Episode = {
  metadata: {
    ...SERIES_CONFIG.episodeDefaults,
    title: "Episode Title",
    subtitle: "Episode subtitle",
  },
  shell: SERIES_CONFIG.shell,
  steps: [ /* step objects */ ],
};
```

## Common properties (all steps)

### Pacing contract

For normal narrated long-form episodes, one `ep.ts` step is usually a 30-60 second beat, with about 45 seconds as the default mental model. This is an estimation range, not a rigid rule. If a plan section needs two or three different jobs to land, split it into multiple steps instead of writing one overloaded narration block or pretending a long `durationInSeconds` creates content depth.

`durationInSeconds` is a placeholder for render timing. The real video duration follows generated audio/subtitles when available, so content depth must come from actual narration and beat count.

| Property | Required | Description |
|----------|----------|-------------|
| `id` | ✅ | Unique step ID — used for audio filenames, must be stable |
| `contentType` | ✅ | Card type (see below) |
| `data` | ✅ | Card payload resolved by the `CardSpec` for this `contentType` |
| `narration` | ✅ | TTS narration text |
| `durationInSeconds` | ✅ | Placeholder duration; overwritten by audio generation |
| `layoutMode` | ❌ | `'title-card'`(default) \| `'card-only'` \| `'fullscreen'` |
| `title` | ❌ | Header title (title-card mode only) |
| `description` | ❌ | Header subtitle |
| `phase` | ❌ | Chapter label shown at top of screen |
| `background` | ❌ | `'default'` \| `'gradient-mesh'` \| `'aurora'` \| `'spotlight'` \| `'minimal'` |
| `effect` | ❌ | `'fadeIn'`(default) \| `'none'` \| `'slideUp'` \| `'springIn'` \| `'blurIn'` \| `'scaleIn'` |
| `effectConfig` | ❌ | `{ durationSec?, delaySec?, direction? }` |
| `speech` | ❌ | Override TTS settings for this step, e.g. `{ voice, rate, pitch }` |

## contentType reference

All card-specific fields live under `step.data`. Do not put legacy fields such as `cardContent`, `imageSrc`, or `summaryPoints` at the top level.

### `cover`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `title` | ❌ | Override episode title on the cover |
| `subtitle` | ❌ | Override episode subtitle on the cover |
| `channelName` | ❌ | Override episode channel name |
| `episodeTag` | ❌ | Override episode tag |
| `animation` | ❌ | `'matrix'` \| `'none'` |

### `ticker`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `content` | ✅ | Ticker text (big display text) |
| `title` | ❌ | Small heading above ticker text |
| `scale` | ❌ | Numeric size multiplier |
| `style` | ❌ | `'flash'`(default) \| `'kinetic'` |

### `markdown`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `cardTitle` | ❌ | Card header title |
| `content` | ✅ | Markdown string (bold, lists, tables, inline code) |
| `frame` | ❌ | `'mac'`(default) \| `'terminal'` \| `'browser'` \| `'simple'` \| `'none'` |

### `code`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `code` | ✅ | Code string |
| `language` | ❌ | Syntax highlight language |
| `title` | ❌ | Terminal/editor title bar |
| `showLineNumbers` | ❌ | Show line numbers (default true) |
| `frame` | ❌ | Window frame kind |

### `image`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `src` | ✅ | Path relative to `public/`, or absolute `/episodes/...`, `http...`, or `data:` |
| `title` | ❌ | Title above image or window title when framed |
| `caption` | ❌ | Placeholder caption; rendered only when `src` points to `PLACEHOLDER_...` |
| `objectFit` | ❌ | `'contain'`(default) \| `'cover'` |
| `frame` | ❌ | Optional window chrome; omit for fullscreen image |
| `animate` | ❌ | Set `false` to skip image enter animation |

### `mermaid`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `chart` | ✅ | Mermaid syntax string |
| `title` | ❌ | Window title above diagram |
| `frame` | ❌ | Window frame kind |

### `summary`
`data`:

| Property | Required | Description |
|----------|----------|-------------|
| `title` | ✅ | Summary heading |
| `points` | ✅ | Bullet points `string[]` (2–4, thesis not chapter list) |
| `cta` | ❌ | Single CTA text |
| `ctaButtons` | ❌ | `(string \| { label: string; icon?: string })[]` |
| `qrCodes` | ❌ | `{ url, title?, subtitle? }[]` |
| `showCta` | ❌ | Whether CTA/QR section renders (default true) |

## Card selection guide

| Situation | Use |
|-----------|-----|
| A vs B comparison | `markdown` table, or generated SVG `image` if visual contrast matters |
| Flow / relationships | `mermaid` |
| Step-by-step process with animation | custom card, or `mermaid` if static reveal is enough |
| Sequence / layers / 3-5 big concepts | `markdown` list/table, `mermaid`, or generated SVG `image` |
| Numbers / KPIs | `markdown`, `ticker`, or generated SVG `image` |
| App UI / chat / terminal / dashboard | `image` screenshot / generated UI SVG |
| Code with syntax highlighting | `code` (always `card-only`) |
| Impact moment / chapter transition | `ticker` |
| General text / lists / tables | `markdown` |
| Opening | `cover` |
| Closing | `summary` |
