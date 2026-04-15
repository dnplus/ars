/**
 * @component ImageCard
 * @description Static Image Viewer with optional Caption
 * 
 * @agent-note
 * **Use Case**: Screenshots, diagrams (static), memes, or architectural overlays.
 * **Features**:
 * - Auto-resolves `public/` paths via `staticFile()`.
 * - Supports `object-fit: contain` (default) or `cover`.
 * - Adds a translucent caption bar at the bottom if `caption` is provided.
 */

import React, { useState } from "react";
import { Img, staticFile } from "remotion";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useTheme } from '../../shared/ThemeContext';

export type ImageCardProps = {
    src: string;
    title?: string;
    caption?: string;
    objectFit?: "cover" | "contain";
    /** 框架類型，預設 'mac' */
    frame?: WindowFrameType;
    /** 是否啟用進場動畫（預設 true） */
    animate?: boolean;
};

const resolveSrc = (src: string) => {
    if (src.startsWith("http") || src.startsWith("data:")) {
        return src;
    }
    // Remove query params if any meant for cache busting, just in case
    const cleanSrc = src.split('?')[0];
    // Handle paths starting with / or logical paths
    return staticFile(cleanSrc.startsWith("/") ? cleanSrc.slice(1) : cleanSrc);
};

const isExplicitPlaceholder = (src: string) => {
    const normalized = src.split('?')[0].split('/').pop() ?? '';
    return normalized.startsWith('PLACEHOLDER_');
};

const toPlaceholderPath = (src: string) => {
    if (!src.trim()) return "(missing imageSrc)";
    if (src.startsWith("http") || src.startsWith("data:")) return src;
    const cleanSrc = src.split('?')[0].replace(/^\/+/, "");
    return `public/${cleanSrc}`;
};

export const ImageCard: React.FC<ImageCardProps> = ({
    src,
    title,
    caption: _caption,
    objectFit = "contain",
    frame = 'mac',
    animate = true,
}) => {
    const theme = useTheme();
    const [hasError, setHasError] = useState(false);
    const trimmedSrc = src.trim();
    const hasSrc = trimmedSrc.length > 0;
    const finalSrc = hasSrc ? resolveSrc(trimmedSrc) : "";
    const showPlaceholder = !hasSrc || hasError || isExplicitPlaceholder(trimmedSrc);

    const placeholderLabel = title || "Image Placeholder";
    const placeholderPath = toPlaceholderPath(trimmedSrc);

    return (
        <BaseCard
            frame={frame}
            frameTitle={title || "Image Viewer"}
            frameTag="IMAGE"
            frameTagColor="purple"
            padding="none"
            animate={animate}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                    backgroundColor: theme.colors.surfaceDark,
                }}
            >
                <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {showPlaceholder ? (
                        <div
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 48,
                                background: `linear-gradient(135deg, ${theme.colors.surfaceDark} 0%, ${theme.colors.secondary} 100%)`,
                            }}
                        >
                            <div
                                style={{
                                    width: "100%",
                                    maxWidth: 960,
                                    borderRadius: 28,
                                    border: `1px dashed ${theme.colors.borderLight}`,
                                    background: "rgba(255, 255, 255, 0.05)",
                                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
                                    padding: "40px 48px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 18,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 18,
                                        letterSpacing: "0.22em",
                                        textTransform: "uppercase",
                                        color: theme.colors.onCardMuted,
                                        fontWeight: 700,
                                    }}
                                >
                                    Placeholder
                                </div>
                                <div
                                    style={{
                                        fontSize: 44,
                                        lineHeight: 1.15,
                                        color: theme.colors.onDark,
                                        fontWeight: 700,
                                    }}
                                >
                                    {placeholderLabel}
                                </div>
                                <div
                                    style={{
                                        fontSize: 24,
                                        lineHeight: 1.5,
                                        color: theme.colors.textLight,
                                        opacity: 0.92,
                                    }}
                                >
                                    {hasError ? "Image failed to load. Showing placeholder for Studio preview." : "Image not provided yet. Showing placeholder for Studio preview."}
                                </div>
                                <div
                                    style={{
                                        marginTop: 8,
                                        padding: "18px 20px",
                                        borderRadius: 18,
                                        background: "rgba(0, 0, 0, 0.28)",
                                        fontFamily: theme.fonts.code,
                                        fontSize: 20,
                                        lineHeight: 1.4,
                                        color: theme.colors.accent,
                                        wordBreak: "break-all",
                                    }}
                                >
                                    {placeholderPath}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 模糊背景層，用來填補因為長寬比不同而留下的空白，並透過 opacity 自然融入底色 */}
                            <Img
                                src={finalSrc}
                                onError={() => setHasError(true)}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    transform: "scale(1.5)",
                                    filter: "blur(60px)",
                                    opacity: 0.5,
                                    zIndex: 0,
                                }}
                            />
                            {/* 原圖層 */}
                            <Img
                                src={finalSrc}
                                onError={() => setHasError(true)}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    objectFit,
                                    zIndex: 1,
                                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)", // 加一點陰影讓主圖更立體，與模糊背景切開
                                }}
                            />
                        </>
                    )}
                </div>
            </div>
        </BaseCard>
    );
};
