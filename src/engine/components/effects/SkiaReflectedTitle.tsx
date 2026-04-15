import {
    Canvas,
    vec,
    Text,
    useFont,
    Group,
    LinearGradient,
} from "@shopify/react-native-skia";
import React from "react";
import { useVideoConfig, useCurrentFrame, interpolate, staticFile } from "remotion";
import { useTheme } from '../../shared/ThemeContext';

export const SkiaReflectedTitle: React.FC<{ title: string; containerWidthRatio?: number }> = ({
    title,
    containerWidthRatio = 1.0 // Default to full width for Cover usage
}) => {
    const theme = useTheme();
    const { width: videoWidth, fps } = useVideoConfig();
    const frame = useCurrentFrame();

    // Calculate actual container width (content box is 77% of video width by default)
    const width = videoWidth * containerWidthRatio;

    // Load Font (Local)
    const fontSize = 110; // Increased to much larger size
    const font = useFont(staticFile("shared/fonts/NotoSansTC-Bold.otf"), fontSize);

    if (!font) {
        return null;
    }

    // Split title into lines if too long
    const maxLineWidth = width * 0.95; // 95% of container width per line
    const lines: string[] = [];

    // Simple line breaking: split by punctuation or max width
    const words = title.split(/([！？。，、])/g).filter(s => s);
    let currentLine = "";

    for (const word of words) {
        const testLine = currentLine + word;
        // Use Skia's getGlyphWidths for accurate measurement
        const glyphIds = font.getGlyphIDs(testLine);
        const glyphWidths = font.getGlyphWidths(glyphIds);
        const estimatedWidth = glyphWidths.reduce((sum, w) => sum + w, 0);

        if (estimatedWidth > maxLineWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }

    const lineHeight = fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    const canvasHeight = Math.max(350, totalHeight + 40); // Dynamic canvas height
    const startY = (canvasHeight - totalHeight) / 2 + fontSize; // Center vertically

    // Animation
    const opacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" });
    const translateY = interpolate(frame, [0, fps], [30, 0], { extrapolateRight: "clamp" });

    return (
        <Canvas style={{ width, height: canvasHeight, margin: '0 auto', overflow: 'visible' }}>
            <Group transform={[{ translateY }]} opacity={opacity}>
                {lines.map((line, index) => {
                    // Use Skia's getGlyphWidths for accurate measurement
                    const glyphIds = font.getGlyphIDs(line);
                    const glyphWidths = font.getGlyphWidths(glyphIds);
                    const estimatedWidth = glyphWidths.reduce((sum, w) => sum + w, 0);

                    // Center each line independently
                    const textX = (width - estimatedWidth) / 2;
                    const textY = startY + index * lineHeight;

                    // Gradient shine animation
                    const shineDuration = fps * 3;
                    const shinePos = interpolate(
                        frame % shineDuration,
                        [0, shineDuration],
                        [textX - 500, textX + estimatedWidth + 500],
                        { extrapolateRight: "clamp" }
                    );

                    return (
                        <Group key={index}>
                            {/* Outer Glow / Stroke 1 (Thick) */}
                            <Text
                                x={textX}
                                y={textY}
                                text={line}
                                font={font}
                                color={theme.colors.primary}
                                style="stroke"
                                strokeWidth={24}
                                strokeJoin="round"
                            />
                            {/* Outer Glow / Stroke 2 (Medium) */}
                            <Text
                                x={textX}
                                y={textY}
                                text={line}
                                font={font}
                                color={theme.colors.primary}
                                strokeWidth={8}
                                style="stroke"
                                strokeJoin="round"
                            />
                            {/* Main Filled Text with Shine */}
                            <Text
                                x={textX}
                                y={textY}
                                text={line}
                                font={font}
                            >
                                <LinearGradient
                                    start={vec(shinePos - 100, 0)}
                                    end={vec(shinePos + 500, 0)}
                                    colors={[
                                        "#f8fafc",
                                        "#ffffff",
                                        theme.colors.accent,
                                        "#ffffff",
                                        "#f8fafc"
                                    ]}
                                />
                            </Text>
                        </Group>
                    );
                })}
            </Group>
        </Canvas>
    );
};
