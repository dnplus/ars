/**
 * Template series configuration — single source of truth.
 * Merges old config.ts + theme.ts into one SeriesConfig export.
 *
 * `npx ars init <name>` 會 bootstrap repo，並複製此檔案作為新 series 的起點。
 */

import { DEFAULT_VTUBER_CONFIG, DEFAULT_SUBTITLE_CONFIG } from '../../engine/shared/defaults';
import type { StreamingLayoutConfig } from '../../engine/layouts/StreamingLayout';
import type { SeriesConfig } from '../../engine/shared/types';

const fontFamily = '"Noto Sans TC", sans-serif';

// ── Theme: "Lo-Fi Earth" ──
const theme = {
  colors: {
    primary: "#c4a77d",
    secondary: "#6b5d4d",
    accent: "#d4b896",
    surfaceLight: "#f5f0e8",
    surfaceDark: "#2d2823",
    surfaceCard: "#3a3530",
    surfaceCardHeader: "#2d2823",
    surfaceCode: "#1e1e1e",
    surfaceOverlay: "rgba(45, 40, 35, 0.85)",
    onLight: "#3d3530",
    onDark: "#f5f0e8",
    onCard: "#e8e0d4",
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

// ── VTuber ──
const vtuber = {
  ...DEFAULT_VTUBER_CONFIG,
  closedImg: 'episodes/template/shared/vtuber/ginseng_closed.png',
  openImg: 'episodes/template/shared/vtuber/ginseng_open.png',
} as const;

// ── Export ──
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
    channelName: 'Your Channel Name', // TODO: customize with your channel name
    brandTag: 'Template Demo',
    voiceId: 'female-shaonv', // MiniMax built-in voice; replace with your clone voice ID if needed
  },
};
