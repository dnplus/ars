/**
 * Default configuration values for episode shells.
 * Import these to reduce boilerplate in episode files.
 */

/**
 * Default VTuber configuration
 * Note: closedImg and openImg paths should be set per-project
 */
export const DEFAULT_VTUBER_CONFIG = {
  enabled: true,
  closedImg: undefined,
  openImg: undefined,
  volumeThreshold: 0.02,
  width: 462,
  height: 462,
} as const;

/**
 * Default subtitle configuration
 */
export const DEFAULT_SUBTITLE_CONFIG = {
  enabled: true,
  style: 'bottom-center' as const,
  fontSize: 46,
  // background 不在此定義 — 各 layout 會 fallback 到 theme.colors.surfaceOverlay
  // 讓各 series 自動跟隨自己的主題色系
} as const;
