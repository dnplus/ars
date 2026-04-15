/**
 * @module shared/constants
 * @description 全域常數定義
 */

export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;

export const AUDIO_THRESHOLD = 0.02;  // VTuber 音量閾值
export const SUBTITLE_WINDOW_MS = 30; // 字幕視窗大小（毫秒）

// ========================================
// Card Spacing 設計系統
// ========================================

export const CARD_SPACING = {
  none: 0,
  sm: 16,
  md: 24,
  lg: 32,
} as const;

export type CardSpacing = keyof typeof CARD_SPACING;
