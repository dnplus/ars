/**
 * @component SummaryCard
 * @description Bullet-point summary with optional Call-to-Action (CTA) buttons or QR code.
 *
 * @agent-note
 * **Use Case**: End-of-chapter recaps or Video Endings.
 * **Animations**:
 * - Title springs in with overshoot
 * - List items slide in with glassmorphism cards and stagger
 * - Emoji prefix auto-detected and rendered as larger icon
 * - Buttons/QR code pop in with spring
 * **Design**: Dark background (overlay), centered layout.
 * **CTA Modes**: Buttons and QR code are mutually exclusive. QR code takes priority.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from '../../shared/ThemeContext';
import { useIsSlidesMode } from '../../shared/effects/useIsSlidesMode';
import { getAdaptiveFontSize, FONT_SIZE_PRESETS } from '../../shared/utils/adaptiveFontSize';

export type CTAButton = {
    label: string;
    icon?: string;
};

export type QRCodeCTA = {
    /** 要生成 QR code 的 URL */
    url: string;
    /** QR code 標題 */
    title?: string;
    /** QR code 副標題/說明 */
    subtitle?: string;
};

export type SummaryCardProps = {
    /** 總結標題 */
    title: string;
    /** 重點列表 (can start with emoji for icon) */
    points: string[];
    /** CTA 按鈕（與 QR code 互斥） */
    ctaButtons?: CTAButton[];
    /** QR Codes CTA（與按鈕互斥，最多 3 個橫向排列） */
    qrCodes?: QRCodeCTA[];
    /** 是否顯示 CTA（按鈕或 QR code），預設 true */
    showCta?: boolean;
};

// Detect leading emoji
const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u;

function parsePoint(text: string): { icon: string | null; label: string } {
    const m = text.match(EMOJI_RE);
    if (m) {
        return { icon: m[0].trim(), label: text.slice(m[0].length) };
    }
    return { icon: null, label: text };
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
    title,
    points,
    ctaButtons = [],
    qrCodes,
    showCta = true,
}) => {
  const theme = useTheme();
    const isSlidesMode = useIsSlidesMode();
    const isRemotion = !isSlidesMode;

    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // 判斷 CTA 模式
    const hasQrCodes = showCta && qrCodes && qrCodes.length > 0;
    const hasButtons = showCta && !hasQrCodes && ctaButtons.length > 0;

    const itemFontSize = useMemo(
        () => getAdaptiveFontSize(points.join(''), FONT_SIZE_PRESETS.subtitle),
        [points],
    );

    // Title spring animation
    const titleProgress = isRemotion ? spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 150, mass: 0.7 },
    }) : 1;
    const titleOpacity = interpolate(titleProgress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const titleSlide = interpolate(titleProgress, [0, 1], [30, 0]);

    // CTA 區域動畫
    const ctaStartFrame = fps * 0.5 + points.length * fps * 0.25;
    const ctaProgress = isRemotion ? spring({
        frame: Math.max(0, frame - ctaStartFrame),
        fps,
        config: { damping: 12, stiffness: 140 },
    }) : 1;
    const ctaOpacity = interpolate(ctaProgress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const ctaScale = interpolate(ctaProgress, [0, 1], [0.85, 1]);

    return (
        <AbsoluteFill
            style={{
                backgroundColor: theme.colors.surfaceDark,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <div style={{ maxWidth: 1200, width: "100%", padding: 40 }}>
                {/* 標題 */}
                <h2
                    style={{
                        fontSize: getAdaptiveFontSize(title, FONT_SIZE_PRESETS.title),
                        fontWeight: 700,
                        color: theme.colors.onPrimary,
                        marginBottom: 40,
                        opacity: titleOpacity,
                        transform: `translateY(${titleSlide}px)`,
                    }}
                >
                    {title}
                </h2>

                {/* 重點列表 */}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {points.map((point, i) => {
                        const itemDelay = Math.floor(fps * 0.3) + i * Math.floor(fps * 0.2);
                        const itemProgress = isRemotion ? spring({
                            frame: Math.max(0, frame - itemDelay),
                            fps,
                            config: { damping: 14, stiffness: 150, mass: 0.6, overshootClamping: false },
                        }) : 1;
                        const itemOpacity = interpolate(itemProgress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                        const slideX = interpolate(itemProgress, [0, 1], [-30, 0]);
                        const itemScale = interpolate(itemProgress, [0, 1], [0.95, 1]);

                        const { icon, label } = parsePoint(point);

                        return (
                            <li
                                key={i}
                                style={{
                                    fontSize: itemFontSize,
                                    color: theme.colors.onCard,
                                    opacity: itemOpacity,
                                    transform: `translateX(${slideX}px) scale(${itemScale})`,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: icon ? 18 : 16,
                                    padding: "18px 28px",
                                    // Glassmorphism item card
                                    background: `${theme.colors.surfaceCard}66`,
                                    backdropFilter: 'blur(4px)',
                                    WebkitBackdropFilter: 'blur(4px)',
                                    borderRadius: 16,
                                    border: `1px solid ${theme.colors.borderLight}40`,
                                }}
                            >
                                {icon ? (
                                    <span style={{ fontSize: '1.5em', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                                ) : (
                                    <span style={{
                                        color: theme.colors.primary,
                                        fontSize: '1.2em',
                                        flexShrink: 0,
                                    }}>✓</span>
                                )}
                                <span style={{ fontWeight: 600 }}>{label}</span>
                            </li>
                        );
                    })}
                </ul>

                {/* QR Codes CTA */}
                {hasQrCodes && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 40,
                            marginTop: 40,
                            opacity: ctaOpacity,
                            transform: `scale(${ctaScale})`,
                        }}
                    >
                        {qrCodes.slice(0, 3).map((qr, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                }}
                            >
                                <div
                                    style={{
                                        padding: 16,
                                        backgroundColor: "#ffffff",
                                        borderRadius: 12,
                                        boxShadow: `0 4px 20px ${theme.colors.shadow}`,
                                    }}
                                >
                                    <QRCodeSVG
                                        value={qr.url}
                                        size={140}
                                        level="M"
                                        bgColor="#ffffff"
                                        fgColor="#000000"
                                    />
                                </div>
                                {qr.title && (
                                    <div style={{
                                        marginTop: 12,
                                        fontSize: 22,
                                        fontWeight: 700,
                                        color: theme.colors.onPrimary,
                                        textAlign: "center",
                                    }}>
                                        {qr.title}
                                    </div>
                                )}
                                {qr.subtitle && (
                                    <div style={{
                                        marginTop: 6,
                                        fontSize: 16,
                                        color: theme.colors.onCardMuted,
                                        textAlign: "center",
                                    }}>
                                        {qr.subtitle}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* CTA 按鈕 */}
                {hasButtons && (
                    <div
                        style={{
                            display: "flex",
                            gap: 20,
                            justifyContent: "center",
                            flexWrap: "wrap",
                            marginTop: 40,
                            opacity: ctaOpacity,
                            transform: `scale(${ctaScale})`,
                        }}
                    >
                        {ctaButtons.map((button, i) => {
                            const btnDelay = ctaStartFrame + i * Math.floor(fps * 0.12);
                            const btnProgress = isRemotion ? spring({
                                frame: Math.max(0, frame - btnDelay),
                                fps,
                                config: { damping: 12, stiffness: 160, mass: 0.5, overshootClamping: false },
                            }) : 1;
                            const btnScale = interpolate(btnProgress, [0, 1], [0.7, 1]);
                            const btnOpacity = interpolate(btnProgress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

                            return (
                                <div
                                    key={i}
                                    style={{
                                        padding: "16px 32px",
                                        background: theme.colors.gradientGold,
                                        borderRadius: 50,
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: theme.colors.onLight,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        boxShadow: `0 4px 20px ${theme.colors.shadow}`,
                                        transform: `scale(${btnScale})`,
                                        opacity: btnOpacity,
                                    }}
                                >
                                    {button.icon && <span style={{ fontSize: 24 }}>{button.icon}</span>}
                                    {button.label}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AbsoluteFill>
    );
};
