/**
 * @scene CaCScene — Content as Code Scene
 *
 * CaC (Content as Code) is the core philosophy of ARS:
 * episode content is declared as structured data (Step), not authored as
 * raw video edits. This scene is the bridge that translates a Step's intent
 * — its contentType, layoutMode, and data — into a visual frame.
 *
 * Responsibilities:
 * 1. Route `step.contentType` to the correct card via the registry
 * 2. Normalize step data into the card's expected props
 * 3. Render the episode header (title / phase / description) when layoutMode = 'title-card'
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { getCard, hasCard } from "../cards/registry";
import { Step, type LayoutMode } from "../shared/types";
import { useTheme } from "../shared/ThemeContext";
import type { EpisodeInfo } from "../renderers/StepRenderer";

export type CaCSceneProps = {
  step: Step;
  episodeTitle: string;
  episodeSubtitle?: string;
  channelName?: string;
  episodeTag?: string;
};

const resolveCardFrame = (layoutMode: LayoutMode) =>
  layoutMode === "fullscreen"
    ? "none"
    : layoutMode === "title-card"
      ? "simple"
      : "mac";

const resolveRegistryType = (contentType: Step["contentType"]) =>
  contentType === "text" ? "markdown" : contentType;

const getStepDataRecord = (step: Step): Record<string, unknown> => {
  if (!step.data || typeof step.data !== "object" || Array.isArray(step.data)) {
    return {};
  }

  return step.data as Record<string, unknown>;
};

const isRegistryRenderable = (contentType: Step["contentType"]): boolean =>
  hasCard(resolveRegistryType(contentType));

const buildRegistryCardData = (
  step: Step,
  layoutMode: LayoutMode,
  episode: EpisodeInfo,
) => {
  const resolvedType = resolveRegistryType(step.contentType);
  const frame = resolveCardFrame(layoutMode);
  const data = getStepDataRecord(step);

  switch (resolvedType) {
    case "cover":
      return {
        ...data,
        title:
          typeof data.title === "string" && data.title.trim().length > 0
            ? data.title
            : episode.title,
        subtitle:
          typeof data.subtitle === "string" && data.subtitle.trim().length > 0
            ? data.subtitle
            : episode.subtitle,
        channelName:
          typeof data.channelName === "string" &&
          data.channelName.trim().length > 0
            ? data.channelName
            : episode.channelName,
        episodeTag:
          typeof data.episodeTag === "string" && data.episodeTag.trim().length > 0
            ? data.episodeTag
            : episode.episodeTag,
        animation: data.animation ?? "none",
      };
    case "markdown":
      return {
        ...data,
        cardTitle:
          typeof data.cardTitle === "string" ? data.cardTitle : "",
        cardTag: typeof data.cardTag === "string" ? data.cardTag : "",
        tagColor: typeof data.tagColor === "string" ? data.tagColor : "blue",
        content: typeof data.content === "string" ? data.content : "",
        frame: data.frame ?? frame,
      };
    case "code":
      return {
        ...data,
        title: typeof data.title === "string" ? data.title : "",
        code: typeof data.code === "string" ? data.code : "",
        language: typeof data.language === "string" ? data.language : "typescript",
        frame: data.frame ?? frame,
      };
    case "image":
      return {
        ...data,
        title: typeof data.title === "string" ? data.title : undefined,
        src: typeof data.src === "string" ? data.src : "",
        caption: typeof data.caption === "string" ? data.caption : undefined,
        objectFit:
          data.objectFit ?? (layoutMode === "fullscreen" ? "cover" : "contain"),
        frame: data.frame ?? frame,
        animate: data.animate ?? !step.skipTransition,
      };
    case "mermaid":
      return {
        ...data,
        title: typeof data.title === "string" ? data.title : "",
        chart: typeof data.chart === "string" ? data.chart : "",
        frame: data.frame ?? frame,
      };
    case "summary":
      return {
        ...data,
        title:
          typeof data.title === "string" && data.title.trim().length > 0
            ? data.title
            : episode.title,
        points: Array.isArray(data.points) ? data.points : [],
        ctaButtons: Array.isArray(data.ctaButtons) ? data.ctaButtons : undefined,
        qrCodes: Array.isArray(data.qrCodes) ? data.qrCodes : undefined,
        showCta: data.showCta ?? true,
      };
    case "ticker":
      return {
        ...data,
        title: typeof data.title === "string" ? data.title : undefined,
        content: typeof data.content === "string" ? data.content : "",
        style: data.style ?? "flash",
      };
    default:
      return data;
  }
};

const renderRegistryCard = (
  step: Step,
  layoutMode: LayoutMode,
  episode: EpisodeInfo,
) => {
  const resolvedType = resolveRegistryType(step.contentType);
  const spec = getCard(resolvedType);
  const CardComponent = spec.component as React.ComponentType<Record<string, unknown>>;

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

export const CaCScene: React.FC<CaCSceneProps> = ({
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
  } satisfies EpisodeInfo;

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

      <div
        style={{
          opacity: cardOpacity,
          minHeight: 0,
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {renderCard(step, layoutMode, episode)}
      </div>
    </AbsoluteFill>
  );
};

function renderCard(
  step: Step,
  layoutMode: LayoutMode,
  episode: EpisodeInfo,
) {
  if (isRegistryRenderable(step.contentType)) {
    return renderRegistryCard(step, layoutMode, episode);
  }

  return null;
}
