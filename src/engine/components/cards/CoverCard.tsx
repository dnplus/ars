/**
 * @component CoverCard
 * @description Episode Title Screen with Intro Animations.
 * 
 * @agent-note
 * **Use Case**: The first 5-10 seconds of the video.
 * **Visuals**:
 * - Bold white title with dark stroke (thumbnail-consistent style).
 * - Badge-style header with theme gradient.
 * - ThreeNetworkBackground optional animation.
 * - **Layout**: Centered, high impact.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeNetworkBackground } from "../effects/ThreeNetworkBackground";
import { useTheme } from '../../shared/ThemeContext';

export type CoverCardProps = {
    /** 主標題 */
    title: string;
    /** 副標題 (可選) */
    subtitle?: string;
    /** 頻道名稱，顯示在標題列（省略則不顯示） */
    channelName?: string;
    /** 左上角標籤文字，例如 'EP5 · GSS'（省略則不顯示） */
    episodeTag?: string;
    /** 背景動畫類型 */
    animation?: 'matrix' | 'none';
};

export const CoverCard: React.FC<CoverCardProps> = ({
    title,
    subtitle,
    channelName,
    episodeTag,
    animation = 'matrix',
}) => {
    const theme = useTheme();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // ── 動畫 ──
    const headerOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
        extrapolateRight: "clamp",
    });
    const headerY = interpolate(frame, [0, fps * 0.4], [-20, 0], {
        extrapolateRight: "clamp",
    });

    const titleOpacity = interpolate(frame, [fps * 0.2, fps * 0.7], [0, 1], {
        extrapolateRight: "clamp",
    });
    const titleScale = interpolate(frame, [fps * 0.2, fps * 0.7], [0.9, 1], {
        extrapolateRight: "clamp",
    });

    const subtitleOpacity = interpolate(frame, [fps * 0.6, fps * 1.0], [0, 1], {
        extrapolateRight: "clamp",
    });

    // ── 標題文字 ──
    const headerText = [channelName, episodeTag].filter(Boolean).join(' · ');
    const titleLines = title.split('\n');
    const titleLen = titleLines.join('').length;

    // 動態字級 (借鏡 ThumbnailCard，適用 1920x1080 橫式影片)
    let titleFontSize: number;
    if (titleLen <= 8) titleFontSize = 270;
    else if (titleLen <= 12) titleFontSize = 225;
    else if (titleLen <= 18) titleFontSize = 180;
    else if (titleLen <= 24) titleFontSize = 150;
    else titleFontSize = 120;

    const c = theme.colors;

    return (
        <AbsoluteFill
            style={{
                backgroundColor: c.surfaceLight,
                fontFamily: theme.fonts.main,
            }}
        >
            {/* Network 背景動畫 */}
            {animation === 'matrix' && (
                <div
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        zIndex: 0,
                    }}
                >
                    <ThreeNetworkBackground />
                </div>
            )}

            {/* 內容層 */}
            <AbsoluteFill
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1,
                    padding: '60px 80px',
                }}
            >
                {/* 頻道名稱 / EP — Badge 風格 */}
                {headerText && (
                    <div
                        style={{
                            opacity: headerOpacity,
                            transform: `translateY(${headerY}px)`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '14px 40px',
                            marginBottom: 24,
                            background: c.gradientGold,
                            border: `2px solid ${c.accent}`,
                            boxShadow: `
                                0 6px 20px ${c.shadowDark},
                                inset 0 1px 0 rgba(255, 255, 255, 0.2)
                            `,
                            borderRadius: 6,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 32,
                                fontWeight: 700,
                                color: c.onPrimary,
                                letterSpacing: 6,
                                textTransform: 'uppercase',
                            }}
                        >
                            {headerText}
                        </span>
                    </div>
                )}

                {/* 主標題 — 深色粗體大字 */}
                <div
                    style={{
                        opacity: titleOpacity,
                        transform: `scale(${titleScale})`,
                        fontSize: titleFontSize,
                        fontWeight: 900,
                        color: c.onLight,
                        lineHeight: 1.15,
                        margin: '24px 0',
                        textAlign: 'center',
                        textShadow: `
                            0 4px 12px ${c.shadow},
                            0 0 20px ${c.primary}22
                        `,
                        maxWidth: '100%',
                        wordBreak: 'keep-all',
                        letterSpacing: titleFontSize > 100 ? -2 : -1,
                    }}
                >
                    {titleLines.map((line, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <br />}
                            {line}
                        </React.Fragment>
                    ))}
                </div>

                {/* 副標題 */}
                {subtitle && (
                    <div
                        style={{
                            opacity: subtitleOpacity,
                            fontSize: 38,
                            fontWeight: 600,
                            color: c.secondary,
                            marginTop: 20,
                            textAlign: 'center',
                            textShadow: `
                                0 2px 8px ${c.shadow}
                            `,
                            letterSpacing: 2,
                        }}
                    >
                        {subtitle}
                    </div>
                )}
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
