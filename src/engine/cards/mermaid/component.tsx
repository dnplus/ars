import React, { useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";
import { WindowSlide } from "../../primitives/WindowSlide";
import type { WindowFrameKind } from "../../primitives/types";
import { useTheme } from "../../shared/ThemeContext";
import type { CardRenderProps } from "../types";

export type MermaidCardData = {
  chart: string;
  title?: string;
  frame?: WindowFrameKind;
};

const MAX_RECOMMENDED_NODES = 15;

const countNodes = (chart: string): number => {
  const nodePattern = /\b[A-Za-z_][A-Za-z0-9_]*\s*[[({<>]/g;
  const matches = chart.match(nodePattern) || [];
  return new Set(
    matches.map((match) => match.trim().split(/[[({<>]/)[0]),
  ).size;
};

export const MermaidCardComponent: React.FC<
  CardRenderProps<MermaidCardData>
> = ({ data }) => {
  const theme = useTheme();
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const warning = useMemo(() => {
    const nodeCount = countNodes(data.chart);
    return nodeCount > MAX_RECOMMENDED_NODES
      ? `Large diagram (${nodeCount} nodes). Prefer <= ${MAX_RECOMMENDED_NODES} for readability.`
      : null;
  }, [data.chart]);

  useEffect(() => {
    let active = true;

    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      themeVariables: {
        primaryColor: theme.colors.surfaceCardHeader,
        primaryTextColor: theme.colors.onLight,
        primaryBorderColor: theme.colors.info,
        lineColor: theme.colors.secondary,
        secondaryColor: theme.colors.surfaceLight,
        tertiaryColor: theme.colors.surfaceCard,
        background: theme.colors.surfaceLight,
        mainBkg: theme.colors.surfaceLight,
        nodeBorder: theme.colors.border,
        clusterBkg: theme.colors.surfaceCard,
        edgeLabelBackground: theme.colors.surfaceLight,
        titleColor: theme.colors.onLight,
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

    const renderChart = async () => {
      if (!data.chart.trim()) {
        setError("No chart definition provided.");
        setSvg("");
        return;
      }

      try {
        const id = `ars-mermaid-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, data.chart);

        if (!active) {
          return;
        }

        setSvg(
          result.svg
            .replace(
              /^<svg /,
              '<svg style="width:100%;height:100%;max-width:100%;max-height:100%;" preserveAspectRatio="xMidYMid meet" ',
            )
            .replace(/width="[^"]*"/, "")
            .replace(/height="[^"]*"/, ""),
        );
        setError(null);
      } catch (renderError) {
        if (!active) {
          return;
        }

        setError(
          renderError instanceof Error
            ? renderError.message
            : "Failed to render diagram.",
        );
        setSvg("");
      }
    };

    void renderChart();

    return () => {
      active = false;
    };
  }, [data.chart, theme]);

  return (
    <WindowSlide
      frame={data.frame ?? "mac"}
      title={data.title || "Diagram"}
      tag="MERMAID"
      tagColor="info"
      innerPadding="none"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: theme.colors.surfaceLight,
        }}
      >
        {warning ? (
          <div
            style={{
              padding: "10px 18px",
              fontSize: 15,
              lineHeight: 1.4,
              color: theme.colors.warning,
              background: theme.colors.surfaceCardHeader,
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            {warning}
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            overflow: "hidden",
          }}
        >
          {error ? (
            <div
              style={{
                maxWidth: 880,
                padding: 24,
                borderRadius: 20,
                background: theme.colors.surfaceCard,
                color: theme.colors.negative,
                fontFamily: theme.fonts.code,
                fontSize: 18,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          ) : svg ? (
            <div
              className="mermaid-svg-container"
              dangerouslySetInnerHTML={{ __html: svg }}
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          ) : (
            <div
              style={{
                color: theme.colors.onCardMuted,
                fontSize: 20,
              }}
            >
              Rendering diagram...
            </div>
          )}
        </div>
      </div>
    </WindowSlide>
  );
};
