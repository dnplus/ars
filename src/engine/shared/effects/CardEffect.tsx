/**
 * @module CardEffect
 * @description 通用卡片進場特效 Wrapper
 * 
 * @agent-note
 * 包在任何 Card 外面，根據 `effect` 屬性自動套用進場動畫。
 * 
 * **支援的特效：**
 * - `none`: 無動畫，直接顯示
 * - `fadeIn`: 淡入（interpolate opacity）
 * - `slideUp`: 從下方滑入 + 淡入
 * - `springIn`: 彈簧縮放進場（推薦預設）
 * - `blurIn`: 模糊淡入
 * - `scaleIn`: 從小放大 + 淡入
 * 
 * **Slides 模式**: 自動跳過所有動畫，直接渲染 children
 * 
 * @example
 * ```tsx
 * <CardEffect effect="springIn">
 *   <InfoCard ... />
 * </CardEffect>
 * ```
 */

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

// ========================================
// Types
// ========================================

export type StepEffect = 'none' | 'fadeIn' | 'slideUp' | 'springIn' | 'blurIn' | 'scaleIn';

export type EffectConfig = {
    /** 動畫持續時間（秒），預設依效果不同 */
    duration?: number;
    /** 動畫延遲（秒），預設 0 */
    delay?: number;
    /** 滑動距離 px（用於 slideUp），預設 30 */
    distance?: number;
    /** 滑動方向（用於 slideUp），預設 'up' */
    direction?: 'up' | 'down' | 'left' | 'right';
};

type CardEffectProps = {
    effect?: StepEffect;
    config?: EffectConfig;
    children: React.ReactNode;
};

// ========================================
// Spring Presets (from remotion-best-practices)
// ========================================

const SPRING_PRESETS = {
    smooth: { damping: 200 },
    snappy: { damping: 20, stiffness: 200 },
    bouncy: { damping: 8 },
    heavy: { damping: 15, stiffness: 80, mass: 2 },
} as const;

// ========================================
// Effect style computation
// ========================================

function computeEffectStyle(
    effect: StepEffect,
    config: EffectConfig,
    frame: number,
    fps: number,
): React.CSSProperties {
    const delay = (config.delay ?? 0) * fps;
    const adjustedFrame = Math.max(0, frame - delay);

    switch (effect) {
        case 'none':
            return {};

        case 'fadeIn': {
            const duration = (config.duration ?? 0.4) * fps;
            const opacity = interpolate(adjustedFrame, [0, duration], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            return { opacity };
        }

        case 'slideUp': {
            const duration = (config.duration ?? 0.4) * fps;
            const distance = config.distance ?? 30;
            const dir = config.direction ?? 'up';

            const progress = interpolate(adjustedFrame, [0, duration], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });

            const offset = (1 - progress) * distance;
            const transformMap: Record<string, string> = {
                up: `translateY(${offset}px)`,
                down: `translateY(${-offset}px)`,
                left: `translateX(${offset}px)`,
                right: `translateX(${-offset}px)`,
            };

            return {
                opacity: progress,
                transform: transformMap[dir],
            };
        }

        case 'springIn': {
            const springProgress = spring({
                frame: adjustedFrame,
                fps,
                config: SPRING_PRESETS.smooth,
            });
            return {
                opacity: springProgress,
                transform: `scale(${interpolate(springProgress, [0, 1], [0.95, 1])})`,
            };
        }

        case 'blurIn': {
            const duration = (config.duration ?? 0.5) * fps;
            const progress = interpolate(adjustedFrame, [0, duration], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            const blur = interpolate(progress, [0, 1], [8, 0]);
            return {
                opacity: progress,
                filter: `blur(${blur}px)`,
            };
        }

        case 'scaleIn': {
            const duration = (config.duration ?? 0.4) * fps;
            const progress = interpolate(adjustedFrame, [0, duration], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            });
            return {
                opacity: progress,
                transform: `scale(${interpolate(progress, [0, 1], [0.85, 1])})`,
            };
        }

        default:
            return {};
    }
}

// ========================================
// Component
// ========================================

export const CardEffect: React.FC<CardEffectProps> = ({
    effect = 'fadeIn',
    config = {},
    children,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const style = useMemo(() => {
        if (effect === 'none') return {};
        return computeEffectStyle(effect, config, frame, fps);
    }, [effect, config, frame, fps]);

    if (effect === 'none') {
        return <>{children}</>;
    }

    return (
        <div style={{ ...style, width: '100%', height: '100%' }}>
            {children}
        </div>
    );
};
