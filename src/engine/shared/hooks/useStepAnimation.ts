/**
 * @module useStepAnimation
 * @description 用於 Step 內的動畫進度控制 Hook
 * 
 * 因為每個 Step 都被包在 <Series.Sequence> 中，
 * Remotion 的 useVideoConfig().durationInFrames 會自動回傳該 Sequence 的時長。
 * 
 * 這個 Hook 利用這個特性，提供歸一化 (0~1) 的 progress，
 * 方便製作「自動適配時長」的動畫（例如長文字捲動）。
 * 
 * **Slides Mode Support**: 
 * 在非 Remotion 環境（如 Slides）下，回傳靜態值 frame=Infinity，
 * 讓組件可以檢測並切換到靜態渲染模式。
 */

import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type UseStepAnimationOptions = {
    /** 入場動畫幀數（絕對幀數），預設 0 */
    entranceFrames?: number;
    /** 出場動畫幀數（絕對幀數），預設 0 */
    exitFrames?: number;
};

export const useStepAnimation = (options: UseStepAnimationOptions = {}) => {
    const { entranceFrames = 0, exitFrames = 0 } = options;

    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    /**
     * 整體進度 (0 -> 1)
     * 基於整個 Step 的持續時間線性插值
     */
    const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    /**
     * 入場進度 (0 -> 1)
     * 在前 entranceFrames 幀完成
     */
    const enterProgress = entranceFrames > 0
        ? interpolate(frame, [0, entranceFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        })
        : 1;

    /**
     * 出場進度 (0 -> 1)
     * 在最後 exitFrames 幀完成
     * 0: 還沒開始出場
     * 1: 完全出場
     */
    const exitProgress = exitFrames > 0
        ? interpolate(
            frame,
            [durationInFrames - exitFrames, durationInFrames],
            [0, 1],
            {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
            }
        )
        : 0;

    return {
        frame,
        durationInFrames,
        progress,
        enterProgress,
        exitProgress,
    };
};
