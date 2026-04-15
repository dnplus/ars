/**
 * @module kineticText
 * @description Shared Kinetic Typography animation utilities.
 *
 * @agent-note
 * **Purpose**: Per-character pop-in animation for high-impact text display.
 * **Style**: Clean & precise — subtle scale + fade + Y-shift, no wild rotation.
 * **Usage**: Used by TickerCard's 'kinetic' mode. Can be reused by any component
 *           that needs character-level entrance animation.
 */

import { interpolate } from "remotion";

export const splitIntoChars = (text: string): string[] => {
    // 使用 Array.from 確保正確處理 Unicode 4-byte 字符 (如 Emoji)
    // 避免 split('') 將一個 Emoji 拆成兩個亂碼
    return Array.from(text);
};

export type KineticConfig = {
    /** Stagger delay between chars (0-1 fraction of total duration). Default: 0.03 */
    stagger?: number;
    /** Each char's animation duration as fraction (0-1). Default: 0.15 */
    charDuration?: number;
    /** Max scale overshoot. Default: 1.1 */
    scaleOvershoot?: number;
    /** Y offset in px at start. Default: 20 */
    yOffset?: number;
};

const DEFAULTS: Required<KineticConfig> = {
    stagger: 0.03,
    charDuration: 0.15,
    scaleOvershoot: 1.1,
    yOffset: 20,
};

/**
 * Calculate animation style for a single character.
 *
 * @param charIndex - Index of the character in the line
 * @param totalChars - Total number of characters in the line
 * @param lineProgress - Overall progress of the current line (0→1)
 * @param fps - Video FPS (for spring calculation)
 * @param config - Optional animation config overrides
 * @returns CSSProperties for the character's current animation state
 */
export const getCharStyle = (
    charIndex: number,
    totalChars: number,
    lineProgress: number,
    fps: number,
    config?: KineticConfig,
): React.CSSProperties => {
    const { stagger, charDuration, scaleOvershoot, yOffset } = {
        ...DEFAULTS,
        ...config,
    };

    // Calculate each char's start/end within the line's progress
    // Ensure all chars finish by progress=1
    const maxStart = Math.max(0, 1 - charDuration);
    const charStart = Math.min(charIndex * stagger, maxStart);
    const charEnd = Math.min(charStart + charDuration, 1);

    // Character-local progress (0→1)
    const charProgress = interpolate(
        lineProgress,
        [charStart, charEnd],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    // Opacity: crisp 0→1
    const opacity = interpolate(charProgress, [0, 0.4], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    // Scale: 0.3 → overshoot → 1.0 (spring-like via interpolate)
    const scale = charProgress < 1
        ? interpolate(charProgress, [0, 0.5, 0.8, 1], [0.3, scaleOvershoot, 1.02, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        })
        : 1;

    // Y offset: yOffset → 0
    const translateY = interpolate(charProgress, [0, 1], [yOffset, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return {
        display: "inline-block",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        // Preserve whitespace width
        whiteSpace: "pre",
    };
};
