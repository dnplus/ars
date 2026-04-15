/**
 * @module useAutoFitFontSize
 * @description DOM-based auto-fit font sizing hook — binary-search 找到容器內最大可容納的 fontSize
 *
 * @agent-note
 * **來源**: 從 InfoCard 抽出的邏輯。
 * **差異**: 與 `getAdaptiveFontSize` (按文字長度估算) 不同，
 *           此 hook 實際測量 DOM 元素，精準度更高。
 * **使用場景**: 文字量不可預測、需要精確填滿容器的情況。
 *
 * ```tsx
 * const { containerRef, textRef, fontSize } = useAutoFitFontSize(content, {
 *   min: 14, max: 72, padding: 28, safetyMargin: 0.9,
 * });
 * ```
 */

import { useRef, useState, useLayoutEffect, useCallback } from 'react';

export type AutoFitOptions = {
  /** 最小字級 (px)，預設 14 */
  min?: number;
  /** 最大字級 (px)，預設 72 */
  max?: number;
  /** 容器內距 (px)，預設 28 */
  padding?: number;
  /** 安全係數 (0-1)，避免 sub-pixel overflow，預設 0.9 */
  safetyMargin?: number;
};

const DEFAULTS: Required<AutoFitOptions> = {
  min: 14,
  max: 72,
  padding: 28,
  safetyMargin: 0.9,
};

/**
 * 用 binary search 測量容器，回傳最佳 fontSize。
 * 回傳 containerRef / textRef 要分別掛到外框和文字元素上。
 */
export function useAutoFitFontSize(
  content: string,
  options?: AutoFitOptions,
) {
  const { min, max, padding, safetyMargin } = { ...DEFAULTS, ...options };

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLPreElement>(null);
  const [fontSize, setFontSize] = useState(max);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const pad = padding * 2;
    const availW = container.clientWidth - pad;
    const availH = container.clientHeight - pad;

    if (availW <= 0 || availH <= 0) return;

    let lo = min;
    let hi = max;
    let best = lo;

    // Temporarily disable wrapping for accurate width measurement
    text.style.whiteSpace = 'pre';
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      text.style.fontSize = `${mid}px`;

      const fits = text.scrollWidth <= availW && text.scrollHeight <= availH;
      if (fits) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    text.style.whiteSpace = 'pre-wrap';

    const safeFontSize = Math.max(min, Math.floor(best * safetyMargin));
    setFontSize(safeFontSize);
    text.style.fontSize = `${safeFontSize}px`;
  }, [content, min, max, padding, safetyMargin]);

  // Run on mount + content change
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(recalc);
    return () => cancelAnimationFrame(raf);
  }, [recalc]);

  // Re-run on container resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => recalc());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recalc]);

  return { containerRef, textRef, fontSize };
}
