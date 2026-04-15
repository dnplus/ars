/**
 * @module StepTransition
 * @description 統一的 Step 過場效果（slide + fade + scale）
 *
 * @agent-note
 * 包在每個 Step 的最外層（Composition.tsx 內），提供一致的過場效果。
 * - **進場**：前 N 幀 fade + slideUp + scale 進場，使用 Easing.out(Easing.cubic)
 * - **出場**：最後 N 幀 fade + scaleDown 淡出
 * - 確保所有 Step 之間的過場行為統一
 *
 * **Slides 模式**: 自動跳過過場動畫
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { useIsSlidesMode } from "./useIsSlidesMode";

export type StepTransitionProps = {
    /** 進場動畫持續幀數，預設 12 */
    enterFrames?: number;
    /** 出場動畫持續幀數，預設 8 */
    exitFrames?: number;
    /** 是否跳過進場（例如第一個 step），預設 false */
    skipEnter?: boolean;
    /** 是否跳過出場（例如最後一個 step），預設 false */
    skipExit?: boolean;
    children: React.ReactNode;
};

export const StepTransition: React.FC<StepTransitionProps> = ({
    enterFrames = 12,
    exitFrames = 8,
    skipEnter = false,
    skipExit = false,
    children,
}) => {
    const isSlidesMode = useIsSlidesMode();
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    if (isSlidesMode) {
        return <>{children}</>;
    }

    // 進場: opacity 0→1 + translateY 30→0 + scale 0.97→1 (ease-out-cubic)
    const enterOpacity = skipEnter
        ? 1
        : interpolate(frame, [0, enterFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
        });

    const enterSlideY = skipEnter
        ? 0
        : interpolate(frame, [0, enterFrames], [24, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
        });

    const enterScale = skipEnter
        ? 1
        : interpolate(frame, [0, enterFrames], [0.97, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
        });

    // 出場: opacity 1→0 + scale 1→0.98 (ease-in-cubic)
    const exitOpacity = skipExit
        ? 1
        : interpolate(
            frame,
            [durationInFrames - exitFrames, durationInFrames],
            [1, 0],
            {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.in(Easing.cubic),
            }
        );

    const exitScale = skipExit
        ? 1
        : interpolate(
            frame,
            [durationInFrames - exitFrames, durationInFrames],
            [1, 0.98],
            {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.in(Easing.cubic),
            }
        );

    const opacity = Math.min(enterOpacity, exitOpacity);
    const scale = frame < durationInFrames - exitFrames ? enterScale : exitScale;
    const translateY = enterSlideY;

    return (
        <div style={{
            opacity,
            transform: `translateY(${translateY}px) scale(${scale})`,
            width: '100%',
            height: '100%',
        }}>
            {children}
        </div>
    );
};
