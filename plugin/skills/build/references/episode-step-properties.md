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
| `narration` | ❌ | TTS narration text |
| `durationInSeconds` | ❌ | Placeholder duration; overwritten by audio generation |
| `layoutMode` | ❌ | `'title-card'`(default) \| `'card-only'` \| `'fullscreen'` |
| `title` | ❌ | Header title (title-card mode only) |
| `description` | ❌ | Header subtitle |
| `phase` | ❌ | Chapter label shown at top of screen |
| `background` | ❌ | `'aurora'` \| `'none'` |
| `effect` | ❌ | `'fadeIn'`(default) \| `'none'` \| `'slideUp'` \| `'springIn'` \| `'blurIn'` \| `'scaleIn'` |
| `effectConfig` | ❌ | `{ durationSec?, delaySec?, direction? }` |
| `speech` | ❌ | Override TTS settings for this step, e.g. `{ voice, rate, pitch }` |

## contentType reference

### `cover`
| Property | Required | Description |
|----------|----------|-------------|
| `animation` | ❌ | `'matrix'` \| `'none'` |

### `ticker`
| Property | Required | Description |
|----------|----------|-------------|
| `cardContent` | ✅ | Ticker text (big display text) |
| `tickerStyle` | ❌ | `'flash'`(default) \| `'kinetic'` |

### `markdown`
| Property | Required | Description |
|----------|----------|-------------|
| `cardContent` | ✅ | Markdown string (bold, lists, tables, inline code) |
| `cardTitle` | ❌ | Card header title |

### `code`
| Property | Required | Description |
|----------|----------|-------------|
| `code` | ✅ | Code string |
| `language` | ❌ | Syntax highlight language |
| `windowTitle` | ❌ | Terminal/editor title bar |

### `image`
| Property | Required | Description |
|----------|----------|-------------|
| `imageSrc` | ✅ | Path relative to `public/` |
| `imageTitle` | ❌ | Title above image |
| `imageCaption` | ❌ | Caption below image |

### `mermaid`
| Property | Required | Description |
|----------|----------|-------------|
| `mermaidChart` | ✅ | Mermaid syntax string |
| `mermaidTitle` | ❌ | Title above diagram |

### `flowchart`
| Property | Required | Description |
|----------|----------|-------------|
| `flowchartNodes` | ✅ | `{ id, label, icon? }[]` |
| `flowchartEdges` | ✅ | `{ from, to, label? }[]` |
| `flowchartDirection` | ❌ | `'TB'`(default) \| `'LR'` — use `'LR'` for 3+ layers |
| `flowchartFocusOrder` | ❌ | `string[]` — node reveal sequence |
| `cardTitle` | ❌ | Card header title |

### `compare`
| Property | Required | Description |
|----------|----------|-------------|
| `compareLeftItems` | ✅ | Left column bullet points `string[]` |
| `compareRightItems` | ✅ | Right column bullet points `string[]` |
| `compareLeftTitle` | ❌ | Left column heading (default: "Before") |
| `compareRightTitle` | ❌ | Right column heading (default: "After") |
| `compareLeftColor` | ❌ | Override left header color |
| `compareRightColor` | ❌ | Override right header color |

### `stats`
| Property | Required | Description |
|----------|----------|-------------|
| `stats` | ✅ | `{ value, label, prefix?, suffix? }[]` — animated count-up |
| `cardTitle` | ❌ | Card header title |

### `timeline`
| Property | Required | Description |
|----------|----------|-------------|
| `timelineItems` | ✅ | `{ title, description?, icon? }[]` |
| `cardTitle` | ❌ | Card header title |

### `summary`
| Property | Required | Description |
|----------|----------|-------------|
| `summaryTitle` | ❌ | Summary heading |
| `summaryPoints` | ❌ | Bullet points `string[]` (2–4, thesis not chapter list) |
| `summaryCtaButtons` | ❌ | `{ label, icon? }[]` |
| `summaryQrCodes` | ❌ | `{ url, title?, subtitle? }[]` |

### `mockApp`
| Property | Required | Description |
|----------|----------|-------------|
| `appDevice` | ✅ | `'desktop'` \| `'mobile'` |
| `appType` | ✅ | `'chat'` \| `'terminal'` \| `'browser'` \| `'dashboard'` |
| `appName` | ❌ | App/window name |
| `appMessages` | chat | `{ role, text, pauseAfter? }[]` |
| `terminalLines` | terminal | `{ type, text, pauseAfter? }[]` |
| `terminalTitle` | terminal | Terminal window title |
| `appUrl` | browser | URL shown in address bar |
| `appImageSrc` | browser | Screenshot path (relative to `public/`). Run `npx ars episode bake <epId>` if only `appUrl` is set. |
| `appBrowserMode` | ❌ | `'meta'` \| `'snapshot'` |
| `chartType` / `chartData` | dashboard | Chart primitive |
| `appInsight` | ❌ | Bottom takeaway callout |
| `stats` | dashboard | Reuse stats array for KPI row |

## Card selection guide

| Situation | Use |
|-----------|-----|
| A vs B comparison | `compare` |
| Flow / relationships | `mermaid` |
| Step-by-step process with animation | `flowchart` with `flowchartFocusOrder` |
| Sequence / layers / 3-5 big concepts | `timeline` |
| Numbers / KPIs | `stats` |
| App UI / chat / terminal / dashboard | `mockApp` |
| Code with syntax highlighting | `code` (always `card-only`) |
| Impact moment / chapter transition | `ticker` |
| General text / lists / tables | `markdown` |
| Opening | `cover` |
| Closing | `summary` |
