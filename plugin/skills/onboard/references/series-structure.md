# Series Structure Reference

After `npx ars init <series>`, the repo contains:

```
src/episodes/<series>/
├── series-config.ts      # Theme tokens + shell config + episode defaults
├── ep-demo.ts            # Demo episode (copied from template)
└── episode.template.ts   # Blank episode template

public/episodes/<series>/
└── shared/
    ├── vtuber/
    │   ├── ginseng_closed.png   # Replace with series VTuber closed-mouth image
    │   └── ginseng_open.png     # Replace with series VTuber open-mouth image
    └── bgm/                     # Optional background music
```

## series-config.ts Structure

This is the only file that needs to be customized after init. It exports `SERIES_CONFIG: SeriesConfig`.

```typescript
import { DEFAULT_VTUBER_CONFIG, DEFAULT_SUBTITLE_CONFIG } from '../../engine/shared/defaults';
import type { StreamingLayoutConfig } from '../../engine/layouts/StreamingLayout';
import type { SeriesConfig } from '../../engine/shared/types';

const fontFamily = '"Noto Sans TC", sans-serif'; // Change to brand font

const theme = {
  colors: {
    primary: "#c4a77d",           // Brand primary color (hex)
    secondary: "#6b5d4d",
    accent: "#d4b896",
    surfaceLight: "#f5f0e8",      // Light background
    surfaceDark: "#2d2823",       // Dark background
    surfaceCard: "#3a3530",       // Card background
    surfaceCardHeader: "#2d2823",
    surfaceCode: "#1e1e1e",
    surfaceOverlay: "rgba(45, 40, 35, 0.85)",
    onLight: "#3d3530",           // Text on light bg
    onDark: "#f5f0e8",            // Text on dark bg
    onCard: "#e8e0d4",            // Text on card
    onCardMuted: "rgba(232, 224, 212, 0.6)",
    onPrimary: "#ffffff",
    onCode: "#d4d4d4",
    positive: "#6b8f71",
    negative: "#8b5e3c",
    info: "#5b7e9e",
    warning: "#c49a5c",
    highlight: "#9b6b8a",
    gradientDark: "linear-gradient(135deg, #2d2823 0%, #3a3530 50%, #252220 100%)",
    gradientGold: "linear-gradient(135deg, #c4a77d, #d4b896)",
    gradientShimmer: "linear-gradient(90deg, #c4a77d, #e8c89e, #d4a574, #c4a77d)",
    border: "#5c5347",
    borderLight: "rgba(255, 255, 255, 0.1)",
    shadow: "rgba(92, 83, 71, 0.2)",
    shadowDark: "rgba(0, 0, 0, 0.4)",
    // Legacy aliases (keep for compat)
    bgLight: "#f5f0e8",
    bgDark: "#2d2823",
    textMain: "#3d3530",
    textInverse: "#ffffff",
    textMuted: "#9ca3af",
    textLight: "#e2e8f0",
    cardBg: "#3a3530",
    cardHeaderBg: "#2d2823",
    codeBackground: "#1e1e1e",
  },
  fonts: {
    main: fontFamily,
    code: '"JetBrains Mono", "Fira Code", monospace',
    fallback: '"Inter", system-ui, sans-serif',
  },
};

const vtuber = {
  ...DEFAULT_VTUBER_CONFIG,
  closedImg: 'episodes/<series>/shared/vtuber/closed.png',
  openImg: 'episodes/<series>/shared/vtuber/open.png',
} as const;

export const SERIES_CONFIG: SeriesConfig = {
  shell: {
    layout: 'streaming',
    config: {
      vtuber,
      subtitle: DEFAULT_SUBTITLE_CONFIG,
    } satisfies StreamingLayoutConfig,
    theme,
  },
  episodeDefaults: {
    width: 1920,
    height: 1080,
    fps: 30,
    channelName: 'Your Channel Name',   // ← Fill from brand interview
    brandTag: 'EP· Tag',                // ← Fill from brand interview
    voiceId: 'female-shaonv',           // ← MiniMax voice ID; replace with clone
  },
};
```

## Key Fields to Fill During Onboarding

| Field | Where | What to put |
|-------|-------|-------------|
| `channelName` | `episodeDefaults` | Full channel display name |
| `brandTag` | `episodeDefaults` | Short tag shown on cover cards (e.g. `"EP · Case Study"`) |
| `voiceId` | `episodeDefaults` | MiniMax voice ID or clone ID |
| `theme.colors.primary` | `theme.colors` | Brand primary hex color |
| `fontFamily` | top of file | Google Font name or system font |
| `vtuber.closedImg` / `openImg` | `vtuber` | Path relative to `public/` |
| `shell.layout` | `shell` | `'streaming'` (16:9, default) or `'shorts'` (9:16 vertical) |
