/**
 * @component TickerCard
 * @description High-Impact Text Display with multiple animation styles.
 * 
 * @agent-note
 * **Tech Stack**: Pure React + CSS (No Skia).
 * **Styles**:
 * - `'flash'` (default): Typewriter character-by-character reveal with cursor.
 * - `'kinetic'`: Kinetic Typography — per-character pop-in with scale + fade + Y-shift.
 * **Key Features**:
 * - **Static Mode**: When used in slides (frame === Infinity), displays all lines stacked.
 * - **Neon Glow**: `textShadow` layering for depth.
 * - **Hold Phase**: Animation finishes at 85%, holding full text for the last 15%.
 * - **Auto-Wrap**: Custom line-breaking logic ensuring stable layout.
 */

import React, { useMemo } from "react";
import { useTheme } from '../../shared/ThemeContext';
import { useStepAnimation } from "../../shared/hooks/useStepAnimation";
import { interpolate, useVideoConfig } from "remotion";
import { splitIntoChars, getCharStyle } from "../../shared/animations/kineticText";

export type TickerStyle = 'flash' | 'kinetic';

export type TickerCardProps = {
    /** 內容 (以換行分隔每句) */
    content: string;
    /** 標題 (通常不顯示，保留介面相容性) */
    title?: string;
    /** 字體大小倍率 (預設 1.0 = 100px based on design) */
    scale?: number;
    /** 動畫風格：'flash' (打字機) | 'kinetic' (逐字彈入) */
    style?: TickerStyle;
    /** 方向 (已棄用，保留介面相容性) */
    direction?: 'horizontal' | 'vertical';
};

export const TickerCard: React.FC<TickerCardProps> = ({
    content,
    scale = 1.0,
    style = 'flash',
}) => {
  const theme = useTheme();
    const { progress, frame } = useStepAnimation();
    const { fps } = useVideoConfig();

    // 1. 解析內容：拆分成多行
    const lines = useMemo(() => {
        return content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }, [content]);

    const totalLines = lines.length;

    // 如果沒有內容，回傳空
    if (totalLines === 0) return null;

    // 樣式設定
    const baseFontSize = 100 * scale;
    const textStyle: React.CSSProperties = {
        fontFamily: theme.fonts.main,
        fontSize: baseFontSize,
        fontWeight: 900,
        lineHeight: 1.2,
        color: theme.colors.onLight,
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        WebkitTextStroke: '2px rgba(0,0,0,0.3)',
        whiteSpace: 'pre-wrap',
    };

    // ─── [Static Mode] 簡報模式：顯示所有行，垂直堆疊 ───
    if (frame === Infinity) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "transparent",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 60,
                    textAlign: "center",
                    gap: 40,
                }}
            >
                {lines.map((line, idx) => (
                    <div key={idx} style={textStyle}>
                        {line}
                    </div>
                ))}
            </div>
        );
    }

    // ─── [Animation Mode] 影片模式 ───

    // 計算當前行 index 和行內進度
    const rawIndex = Math.floor(progress * totalLines);
    const currentIndex = Math.min(rawIndex, totalLines - 1);
    const currentLine = lines[currentIndex];

    const timePerLine = 1 / totalLines;
    const lineStartP = currentIndex * timePerLine;
    const lineTotalDuration = timePerLine;

    const animationRatio = 0.85;
    const lineAnimateEndP = lineStartP + (lineTotalDuration * animationRatio);

    const lineProgress = interpolate(progress, [lineStartP, lineAnimateEndP], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    // ─── Flash Mode (打字機) ───
    if (style === 'flash') {
        const fullChars = [...currentLine];
        const visibleCharCount = Math.floor(fullChars.length * lineProgress);
        const visibleText = fullChars.slice(0, visibleCharCount).join('');

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "transparent",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 60,
                    textAlign: "center",
                }}
            >
                <div style={textStyle}>
                    {visibleText}
                    {/* 游標效果 */}
                    <span style={{
                        opacity: lineProgress < 1 ? 1 : 0,
                        color: theme.colors.primary,
                        marginLeft: 4
                    }}>
                        |
                    </span>
                </div>
            </div>
        );
    }

    // ─── Kinetic Mode (逐字彈入) ───
    const chars = splitIntoChars(currentLine);

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 60,
                textAlign: "center",
            }}
        >
            <div style={{ ...textStyle, display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
                {chars.map((char, i) => (
                    <span
                        key={`${currentIndex}-${i}`}
                        style={getCharStyle(i, chars.length, lineProgress, fps)}
                    >
                        {char}
                    </span>
                ))}
            </div>
        </div>
    );
};
