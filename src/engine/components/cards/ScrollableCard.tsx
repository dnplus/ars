/**
 * @component ScrollableCard
 * @description Extends BaseCard with auto-scroll and word-wrap for long content.
 * 
 * @agent-note
 * **Use Case**: For text-heavy cards (Code, Markdown, Info) that may overflow.
 * **Features**:
 * - Auto word-wrap on horizontal overflow
 * - Auto-scroll on vertical overflow based on step duration
 * - Smooth easeInOut scrolling animation
 * - Inherits all BaseCard props
 * **Slides Mode**: Disables animation when not in Remotion context
 */

import React, { useRef, useLayoutEffect, useState } from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { BaseCard, type BaseCardProps } from "./BaseCard";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";

export type ScrollableCardProps = BaseCardProps & {
  /** 是否啟用自動捲動，預設 true */
  autoScroll?: boolean;
  /** 開始捲動的延遲比例 (0-1)，預設 0.05 */
  scrollStartRatio?: number;
  /** 結束捲動的時間比例 (0-1)，預設 0.95 */
  scrollEndRatio?: number;
};

export const ScrollableCard: React.FC<ScrollableCardProps> = ({
  autoScroll = true,
  scrollStartRatio = 0.05,
  scrollEndRatio = 0.95,
  children,
  ...baseCardProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxScroll, setMaxScroll] = useState(0);

  const isSlidesMode = useIsSlidesMode();
  const isRemotion = !isSlidesMode;

  // 呼叫 hooks（在 Slides 模式下，這些會返回 mock 的值）
  const currentFrame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 使用 useLayoutEffect + requestAnimationFrame 確保內容渲染完成後再計算
  useLayoutEffect(() => {
    const timer = requestAnimationFrame(() => {
      if (containerRef.current && contentRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const contentHeight = contentRef.current.scrollHeight;
        const scroll = Math.max(0, contentHeight - containerHeight);
        setMaxScroll(scroll);
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [children]);

  // 計算捲動位置（Slides 模式下不捲動）
  const scrollY = isRemotion && autoScroll && maxScroll > 0
    ? (() => {
      const startFrame = Math.floor(durationInFrames * scrollStartRatio);
      const endFrame = Math.floor(durationInFrames * scrollEndRatio);
      return interpolate(
        currentFrame,
        [startFrame, endFrame],
        [0, maxScroll],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        }
      );
    })()
    : 0;

  return (
    <BaseCard {...baseCardProps}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          // Slides 模式：允許手動捲動；Remotion 模式：隱藏捲軸（用動畫控制）
          overflow: isRemotion ? "hidden" : "auto",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translateY(-${scrollY}px)`,
            willChange: isRemotion && autoScroll && maxScroll > 0 ? "transform" : "auto",
            wordWrap: "break-word",
            overflowWrap: "break-word",
            whiteSpace: "pre-wrap",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </div>
    </BaseCard>
  );
};
