/**
 * @module useAdaptiveFontSize
 * @description 動態字級計算 — 根據內容長度自動調整 fontSize
 * 
 * @agent-note
 * **使用方式**:
 * ```tsx
 * const fontSize = useAdaptiveFontSize(text, { min: 18, max: 32, breakpoints: [100, 200, 400] });
 * ```
 * 
 * **計算邏輯**:
 * - 文字 ≤ breakpoints[0] → max fontSize
 * - 文字 ≥ breakpoints[last] → min fontSize
 * - 中間做線性 interpolate
 * 
 * **所有卡片共用**，避免各自 hardcode fontSize。
 */

type AdaptiveFontSizeOptions = {
  /** 最小字級 (px) */
  min?: number;
  /** 最大字級 (px) */
  max?: number;
  /** 文字長度斷點 [short, medium, long]，用於分段計算 */
  breakpoints?: [number, number, number];
  /** 結果倍率 (預設 1.0)，用於特定卡片需要更大字級 */
  scale?: number;
};

const DEFAULT_OPTIONS: Required<Omit<AdaptiveFontSizeOptions, 'scale'>> & { scale: number } = {
  min: 20,
  max: 36,
  breakpoints: [80, 200, 500],
  scale: 1,
};

/**
 * 根據文字長度計算合適的 fontSize
 */
export function getAdaptiveFontSize(
  content: string | string[],
  options?: AdaptiveFontSizeOptions,
): number {
  const { min, max, breakpoints, scale } = { ...DEFAULT_OPTIONS, ...options };

  // 取得總文字量
  const totalLength = Array.isArray(content)
    ? content.reduce((sum, item) => sum + item.length, 0)
    : content.length;

  // Count items for list-style content
  const itemCount = Array.isArray(content) ? content.length : 1;

  // Consider both total text length and item count
  const effectiveLength = totalLength + itemCount * 20; // Each item adds padding equivalent

  let size: number;
  if (effectiveLength <= breakpoints[0]) size = max;
  else if (effectiveLength >= breakpoints[2]) size = min;
  else {
    // Linear interpolation
    const ratio = (effectiveLength - breakpoints[0]) / (breakpoints[2] - breakpoints[0]);
    size = max - ratio * (max - min);
  }

  return Math.round(size * scale);
}

/**
 * Preset configurations for common content patterns
 */
export const FONT_SIZE_PRESETS = {
  /** Markdown / general body copy */
  body: { min: 22, max: 38, breakpoints: [60, 150, 400] } as Required<AdaptiveFontSizeOptions>,

  /** Short list items */
  listItem: { min: 22, max: 32, breakpoints: [40, 100, 250] } as Required<AdaptiveFontSizeOptions>,

  /** Metric labels */
  label: { min: 18, max: 28, breakpoints: [20, 60, 120] } as Required<AdaptiveFontSizeOptions>,

  /** Supporting descriptions */
  description: { min: 20, max: 30, breakpoints: [50, 120, 300] } as Required<AdaptiveFontSizeOptions>,

  /** Section headings */
  heading: { min: 22, max: 34, breakpoints: [10, 30, 80] } as Required<AdaptiveFontSizeOptions>,

  /** Large titles */
  title: { min: 36, max: 64, breakpoints: [10, 30, 60] } as Required<AdaptiveFontSizeOptions>,

  /** Secondary titles */
  subtitle: { min: 28, max: 42, breakpoints: [20, 50, 120] } as Required<AdaptiveFontSizeOptions>,

  /** Captions */
  caption: { min: 18, max: 28, breakpoints: [20, 60, 150] } as Required<AdaptiveFontSizeOptions>,
} as const;
