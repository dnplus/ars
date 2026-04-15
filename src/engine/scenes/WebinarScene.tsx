/**
 * @scene WebinarScene
 * @description Main Content Renderer / Scene Router
 *
 * @agent-note
 * This component acts as a **Factory/Router**. It takes a `Step` and renders the appropriate Card.
 *
 * **Mapping Logic (contentType -> Component):**
 * - `cover` -> `<CoverCard>` (片頭/章節頭)
 * - `summary` -> `<SummaryCard>` (總結/片尾)
 * - `ticker` -> `<TickerCard>` ("FlashText")
 * - `compare` -> `<CompareCard>` (左右對比)
 * - `stats` -> `<StatsCard>` (KPI 數據)
 * - `timeline` -> `<TimelineCard>` (時間軸)
 * - `code` -> `<CodeCard>`
 * - `markdown` -> `<MarkdownCard>`
 * - `mermaid` -> `<MermaidCard>`
 * - `image` -> `<ImageCard>`
 * - `text` -> `<MarkdownCard>` (alias)
 *
 * @props {@link WebinarSceneProps}
 * @see src/shared/types.ts for Step definitions
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { Step, type LayoutMode } from "../shared/types";
import { useTheme } from "../shared/ThemeContext";

// Cards
import { MarkdownCard } from "../components/cards/MarkdownCard";
import { CodeCard } from "../components/cards/CodeCard";
import { ImageCard } from "../components/cards/ImageCard";
import { MermaidCard } from "../components/cards/MermaidCard";
import { CoverCard } from "../components/cards/CoverCard";
import { SummaryCard } from "../components/cards/SummaryCard";
import { TickerCard } from "../components/cards/TickerCard";
import { ContextCard } from "../components/cards/ContextCard";
import { CompareCard } from "../components/cards/CompareCard";
import { StatsCard } from "../components/cards/StatsCard";
import { TimelineCard } from "../components/cards/TimelineCard";
import { MockAppCard } from "../components/cards/MockAppCard";
import { FlowchartCard } from "../components/cards/FlowchartCard";

export type WebinarSceneProps = {
  step: Step;
  episodeTitle: string;
  episodeSubtitle?: string;
  channelName?: string;
  episodeTag?: string;
};

export const WebinarScene: React.FC<WebinarSceneProps> = ({
  step,
  episodeTitle,
  episodeSubtitle,
  channelName,
  episodeTag,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { contentType } = step;

  // Cover - 全螢幕卡片（片頭/章節頭）
  if (contentType === "cover") {
    return (
      <CoverCard
        title={step.title || episodeTitle}
        subtitle={step.description || episodeSubtitle}
        channelName={channelName}
        episodeTag={episodeTag}
        animation={step.animation ?? "none"}
      />
    );
  }

  // Summary - 全螢幕卡片（總結/片尾）
  if (contentType === "summary") {
    return (
      <AbsoluteFill style={{ backgroundColor: theme.colors.surfaceDark }}>
        <SummaryCard
          title={step.summaryTitle || ""}
          points={step.summaryPoints || []}
          ctaButtons={step.summaryCtaButtons}
          qrCodes={step.summaryQrCodes}
          showCta={step.summaryShowCta ?? true}
        />
      </AbsoluteFill>
    );
  }

  // Other Content Types
  const layoutMode: LayoutMode = step.layoutMode || "title-card";
  const showHeader = layoutMode === "title-card";

  // skipTransition: 跳過內部 card fadeIn（連續 fullscreen 不閃黑）
  const skipAnim = !!step.skipTransition;

  const titleOpacity = skipAnim
    ? 1
    : interpolate(frame, [0, fps * 0.4], [0, 1], {
        extrapolateRight: "clamp",
      });
  const titleSlide = skipAnim
    ? 0
    : interpolate(frame, [0, fps * 0.4], [-20, 0], {
        extrapolateRight: "clamp",
      });
  const cardOpacity = skipAnim
    ? 1
    : interpolate(frame, [fps * 0.2, fps * 0.6], [0, 1], {
        extrapolateRight: "clamp",
      });

  // card-only 和 fullscreen 模式：卡片貼齊 Content Box，無 padding
  const noPadding = layoutMode === "card-only" || layoutMode === "fullscreen";

  const isFullscreen = layoutMode === "fullscreen";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isFullscreen
          ? theme.colors.surfaceCard
          : theme.colors.surfaceLight,
        display: "grid",
        gridTemplateRows: showHeader ? "auto 1fr" : "1fr",
        gap: showHeader ? 24 : 0,
        padding: noPadding ? 0 : 32,
      }}
    >
      {/* Header - 僅在 title-card 模式顯示 */}
      {showHeader && (
        <div
          style={{
            transform: `translateY(${titleSlide}px)`,
            opacity: titleOpacity,
          }}
        >
          {/* Phase Badge */}
          {step.phase && (
            <div
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: theme.colors.gradientGold,
                color: theme.colors.onPrimary,
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              {step.phase}
            </div>
          )}

          {/* Title */}
          {step.title && (
            <h2
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: theme.colors.onLight,
                margin: 0,
                marginBottom: 8,
              }}
            >
              {step.title}
            </h2>
          )}

          {/* Description */}
          {step.description && (
            <p
              style={{ fontSize: 18, color: theme.colors.secondary, margin: 0 }}
            >
              {step.description}
            </p>
          )}
        </div>
      )}

      {/* Card Content */}
      <div style={{ opacity: cardOpacity, minHeight: 0, height: "100%" }}>
        {step.ctx ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              height: "100%",
            }}
          >
            <div style={{ flex: "0 0 20%", minHeight: 0, overflow: "hidden" }}>
              <ContextCard
                ctx={step.ctx}
                visTitle={step.visTitle}
                visIcon={step.visIcon}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {renderCard(step, layoutMode)}
            </div>
          </div>
        ) : (
          renderCard(step, layoutMode)
        )}
      </div>
    </AbsoluteFill>
  );
};

function renderCard(step: Step, layoutMode: LayoutMode) {
  const { contentType } = step;
  // fullscreen：無框架 / title-card：簡潔容器（標題由 Scene header 顯示）/ card-only：mac 框架自帶標題
  const cardFrame =
    layoutMode === "fullscreen"
      ? "none"
      : layoutMode === "title-card"
        ? "simple"
        : "mac";

  switch (contentType) {
    case "text": // alias → MarkdownCard
    case "markdown":
      return (
        <MarkdownCard
          cardTitle={step.cardTitle || ""}
          cardTag={step.cardTag || ""}
          tagColor={step.tagColor || "blue"}
          content={step.cardContent || ""}
          frame={cardFrame}
        />
      );

    case "code":
      return (
        <CodeCard
          title={step.windowTitle || ""}
          code={step.code || ""}
          language={step.language || "typescript"}
          frame={cardFrame}
        />
      );

    case "image":
      return (
        <ImageCard
          title={step.imageTitle}
          src={step.imageSrc || ""}
          caption={step.imageCaption}
          objectFit={layoutMode === "fullscreen" ? "cover" : "contain"}
          frame={cardFrame}
          animate={!step.skipTransition}
        />
      );

    case "mermaid":
      return (
        <MermaidCard
          title={step.mermaidTitle || ""}
          chart={step.mermaidChart || ""}
          frame={cardFrame}
        />
      );

    case "compare":
      return (
        <CompareCard
          leftTitle={step.compareLeftTitle || "Before"}
          leftItems={step.compareLeftItems || []}
          rightTitle={step.compareRightTitle || "After"}
          rightItems={step.compareRightItems || []}
          leftColor={step.compareLeftColor}
          rightColor={step.compareRightColor}
          cardTitle={step.cardTitle}
        />
      );

    case "stats":
      return <StatsCard stats={step.stats || []} cardTitle={step.cardTitle} />;

    case "timeline":
      return (
        <TimelineCard
          items={step.timelineItems || []}
          cardTitle={step.cardTitle}
        />
      );

    case "ticker":
      return (
        <TickerCard
          content={step.cardContent || ""}
          title={step.cardTitle}
          direction={step.tickerDirection || "vertical"}
          style={step.tickerStyle || "flash"}
        />
      );

    case "mockApp":
      return (
        <MockAppCard
          device={step.appDevice || "desktop"}
          type={step.appType || "chat"}
          appName={step.appName}
          messages={step.appMessages || []}
          charsPerSecond={step.appCharsPerSecond}
          inputPlaceholder={step.appInputPlaceholder}
          terminalTitle={step.terminalTitle || step.windowTitle || step.appName}
          terminalLines={step.terminalLines || []}
          terminalCharsPerSecond={step.terminalCharsPerSecond}
          browserMode={step.appBrowserMode}
          browserLayout={step.appBrowserLayout}
          browserUrl={step.appUrl}
          browserImageSrc={step.appImageSrc || step.imageSrc}
          dashboardStats={step.stats || []}
          dashboardChartType={step.dashboardChartType || step.chartType || "bar"}
          dashboardChartData={step.dashboardChartData || step.chartData || []}
          dashboardValuePrefix={step.dashboardValuePrefix || step.chartValuePrefix}
          dashboardValueSuffix={step.dashboardValueSuffix || step.chartValueSuffix}
          dashboardSourceLabel={step.dashboardSourceLabel || step.chartSourceLabel}
          dashboardInsight={step.dashboardInsight || step.appInsight || step.description}
        />
      );

    case "flowchart":
      return (
        <FlowchartCard
          nodes={step.flowchartNodes || []}
          edges={step.flowchartEdges || []}
          direction={step.flowchartDirection || "TB"}
          focusOrder={step.flowchartFocusOrder}
          title={step.cardTitle}
          frame={cardFrame}
        />
      );

    default:
      return null;
  }
}
