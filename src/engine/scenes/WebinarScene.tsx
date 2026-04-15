/**
 * @scene WebinarScene
 * @description Main content renderer with registry-first card routing.
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getCard } from "../cards/registry";
import { ContextCard } from "../components/cards/ContextCard";
import { CompareCard } from "../components/cards/CompareCard";
import { FlowchartCard } from "../components/cards/FlowchartCard";
import { MockAppCard } from "../components/cards/MockAppCard";
import { StatsCard } from "../components/cards/StatsCard";
import { TimelineCard } from "../components/cards/TimelineCard";
import { Step, type LayoutMode } from "../shared/types";
import { useTheme } from "../shared/ThemeContext";

export type WebinarSceneProps = {
  step: Step;
  episodeTitle: string;
  episodeSubtitle?: string;
  channelName?: string;
  episodeTag?: string;
};

type EpisodeCardContext = {
  title: string;
  subtitle?: string;
  channelName?: string;
  episodeTag?: string;
};

type RegistryRenderableType =
  | "cover"
  | "code"
  | "image"
  | "markdown"
  | "mermaid"
  | "summary"
  | "ticker";

const isCustomCardType = (contentType: Step["contentType"]) =>
  contentType.includes("/");

const resolveCardFrame = (layoutMode: LayoutMode) =>
  layoutMode === "fullscreen"
    ? "none"
    : layoutMode === "title-card"
      ? "simple"
      : "mac";

const resolveRegistryType = (contentType: Step["contentType"]) =>
  contentType === "text" ? "markdown" : contentType;

const isRegistryRenderable = (
  contentType: Step["contentType"],
): contentType is RegistryRenderableType | "text" => {
  if (isCustomCardType(contentType)) {
    return true;
  }

  const resolvedType = resolveRegistryType(contentType);

  return (
    resolvedType === "cover" ||
    resolvedType === "code" ||
    resolvedType === "image" ||
    resolvedType === "markdown" ||
    resolvedType === "mermaid" ||
    resolvedType === "summary" ||
    resolvedType === "ticker"
  );
};

const buildRegistryCardData = (
  step: Step,
  layoutMode: LayoutMode,
  episode: EpisodeCardContext,
) => {
  const resolvedType = resolveRegistryType(step.contentType);
  const frame = resolveCardFrame(layoutMode);

  switch (resolvedType) {
    case "cover":
      return {
        title: step.title || episode.title,
        subtitle: step.description || episode.subtitle,
        channelName: episode.channelName,
        episodeTag: episode.episodeTag,
        animation: step.animation ?? "none",
      };
    case "markdown":
      return {
        cardTitle: step.cardTitle || step.title || "",
        cardTag: step.cardTag || "",
        tagColor: step.tagColor || "blue",
        content: step.cardContent || step.description || "",
        frame,
      };
    case "code":
      return {
        title: step.windowTitle || step.cardTitle || step.title || "",
        code: step.code || "",
        language: step.language || "typescript",
        frame,
      };
    case "image":
      return {
        title: step.imageTitle || step.cardTitle || step.title,
        src: step.imageSrc || "",
        caption: step.imageCaption || step.description,
        objectFit: layoutMode === "fullscreen" ? "cover" : "contain",
        frame,
        animate: !step.skipTransition,
      };
    case "mermaid":
      return {
        title: step.mermaidTitle || step.cardTitle || step.title || "",
        chart: step.mermaidChart || "",
        frame,
      };
    case "summary":
      return {
        title: step.summaryTitle || step.title || episode.title,
        points: step.summaryPoints || [],
        ctaButtons: step.summaryCtaButtons,
        qrCodes: step.summaryQrCodes,
        showCta: step.summaryShowCta ?? true,
      };
    case "ticker":
      return {
        title: step.cardTitle || step.title,
        content: step.cardContent || "",
        style: step.tickerStyle || "flash",
      };
    default:
      return step.data ?? step;
  }
};

const renderRegistryCard = (
  step: Step,
  layoutMode: LayoutMode,
  episode: EpisodeCardContext,
) => {
  const resolvedType = resolveRegistryType(step.contentType);
  const spec = getCard(resolvedType);
  const CardComponent = spec.component as React.ComponentType<any>;

  return (
    <CardComponent
      data={buildRegistryCardData(step, layoutMode, episode)}
      step={{
        id: step.id,
        durationInSeconds: step.durationInSeconds,
        narration: step.narration,
        layoutMode,
      }}
      episode={episode}
    />
  );
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
  const episode = {
    title: episodeTitle,
    subtitle: episodeSubtitle,
    channelName,
    episodeTag,
  } satisfies EpisodeCardContext;

  if (step.contentType === "cover" || step.contentType === "summary") {
    return renderRegistryCard(step, step.layoutMode || "fullscreen", episode);
  }

  const layoutMode: LayoutMode = step.layoutMode || "title-card";
  const showHeader = layoutMode === "title-card";
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
      {showHeader ? (
        <div
          style={{
            transform: `translateY(${titleSlide}px)`,
            opacity: titleOpacity,
          }}
        >
          {step.phase ? (
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
          ) : null}

          {step.title ? (
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
          ) : null}

          {step.description ? (
            <p
              style={{ fontSize: 18, color: theme.colors.secondary, margin: 0 }}
            >
              {step.description}
            </p>
          ) : null}
        </div>
      ) : null}

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
              {renderCard(step, layoutMode, episode)}
            </div>
          </div>
        ) : (
          renderCard(step, layoutMode, episode)
        )}
      </div>
    </AbsoluteFill>
  );
};

function renderCard(
  step: Step,
  layoutMode: LayoutMode,
  episode: EpisodeCardContext,
) {
  if (isRegistryRenderable(step.contentType)) {
    return renderRegistryCard(step, layoutMode, episode);
  }

  switch (step.contentType) {
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
          frame={resolveCardFrame(layoutMode)}
        />
      );
    default:
      return null;
  }
}
