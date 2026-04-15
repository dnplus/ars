/**
 * @component MermaidCard
 * @description Dynamic Mermaid.js Chart Renderer
 * 
 * @agent-note
 * **Use Case**: FLowcharts, Sequence Diagrams, ERDs.
 * **Tech**: Renders client-side using `mermaid` library.
 * **Warning**: Large diagrams (>15 nodes) may be unreadable. Use `ImageCard` for complex architecture dumps.
 * **Auto-Scaling**: SVG is manipulated to fit the container.
 */
import React, { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useTheme } from '../../shared/ThemeContext';

// Max recommended node count for readability
const MAX_RECOMMENDED_NODES = 15;

// Count nodes in mermaid chart (rough estimate)
const countNodes = (chart: string): number => {
    const nodePattern = /\b[A-Za-z_][A-Za-z0-9_]*\s*[[({<>]/g;
    const matches = chart.match(nodePattern) || [];
    return new Set(matches.map((m) => m.trim().split(/[[({<>]/)[0])).size;
};

export type MermaidCardProps = {
    title?: string;
    chart: string;
    /** 框架類型，預設 'mac' */
    frame?: WindowFrameType;
};

export const MermaidCard: React.FC<MermaidCardProps> = ({ title, chart, frame = 'mac' }) => {
  const theme = useTheme();
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const initialized = useRef(false);

    // Initialize mermaid once
    useEffect(() => {
        if (!initialized.current) {
            mermaid.initialize({
                startOnLoad: false,
                theme: "neutral",
                themeVariables: {
                    primaryColor: theme.colors.primary,
                    primaryTextColor: theme.colors.onLight,
                    primaryBorderColor: theme.colors.secondary,
                    lineColor: theme.colors.secondary,
                    secondaryColor: "#e8ddd0",
                    tertiaryColor: "#f5f0e8",
                    background: "#f5f0e8",
                    mainBkg: "#f5f0e8",
                    nodeBorder: theme.colors.secondary,
                    clusterBkg: "#e8ddd0",
                    titleColor: theme.colors.onLight,
                    edgeLabelBackground: "#ffffff",
                    nodeTextColor: theme.colors.onLight,
                },
                fontFamily: theme.fonts.main,
                flowchart: {
                    curve: "basis",
                    padding: 20,
                    nodeSpacing: 50,
                    rankSpacing: 50,
                },
            });
            initialized.current = true;
        }
    }, []);

    // Render chart
    useEffect(() => {
        const renderChart = async () => {
            if (!chart.trim()) {
                setError("No chart definition provided");
                return;
            }

            // Complexity check
            const nodeCount = countNodes(chart);
            if (nodeCount > MAX_RECOMMENDED_NODES) {
                setWarning(`⚠️ 圖表有 ${nodeCount} 個節點，建議 ≤${MAX_RECOMMENDED_NODES} 以確保可讀性`);
            } else {
                setWarning(null);
            }

            try {
                const id = `mermaid-${Date.now()}`;
                const { svg: renderedSvg } = await mermaid.render(id, chart);

                // Modify SVG to scale and fit container
                const scaledSvg = renderedSvg
                    .replace(/^<svg /, '<svg style="width:100%;height:100%;max-width:100%;max-height:100%;" preserveAspectRatio="xMidYMid meet" ')
                    .replace(/width="[^"]*"/, '')
                    .replace(/height="[^"]*"/, '');

                setSvg(scaledSvg);
                setError(null);
            } catch (err) {
                console.error("Mermaid rendering error:", err);
                setError(err instanceof Error ? err.message : "Failed to render diagram");
            }
        };

        renderChart();
    }, [chart]);

    return (
        <BaseCard
            frame={frame}
            frameTitle={title || "Diagram"}
            frameTag="DIAGRAM"
            frameTagColor="cyan"
            padding="none"
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.surfaceLight,
                    overflow: "hidden",
                }}
            >
                {warning && (
                    <div
                        style={{
                            color: "#d97706",
                            fontFamily: theme.fonts.code,
                            fontSize: 12,
                            marginBottom: 8,
                        }}
                    >
                        {warning}
                    </div>
                )}
                {error ? (
                    <div
                        style={{
                            color: "#ef4444",
                            fontFamily: theme.fonts.code,
                            fontSize: 14,
                        }}
                    >
                        Error: {error}
                    </div>
                ) : svg ? (
                    <div
                        dangerouslySetInnerHTML={{ __html: svg }}
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                        className="mermaid-svg-container"
                    />
                ) : (
                    <div style={{ color: theme.colors.onCardMuted }}>Loading diagram...</div>
                )}
            </div>
        </BaseCard>
    );
};
