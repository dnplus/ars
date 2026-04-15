import React from "react";
import { AbsoluteFill } from "remotion";
import { BaseSlide } from "../../primitives/BaseSlide";
import { useTheme } from "../../shared/ThemeContext";
import type { CardRenderProps } from "../types";

export type CoverCardData = {
  title?: string;
  subtitle?: string;
  channelName?: string;
  episodeTag?: string;
  animation?: "matrix" | "none";
};

export const CoverCardComponent: React.FC<CardRenderProps<CoverCardData>> = ({
  data,
  episode,
}) => {
  const theme = useTheme();
  const c = theme.colors;
  const title = data.title ?? episode.title;
  const subtitle = data.subtitle ?? episode.subtitle;
  const channelName = data.channelName ?? episode.channelName;
  const episodeTag = data.episodeTag ?? episode.episodeTag;
  const headerText = [channelName, episodeTag].filter(Boolean).join(" · ");
  const titleLines = title.split("\n");
  const titleLen = titleLines.join("").length;

  let titleFontSize: number;
  if (titleLen <= 8) titleFontSize = 270;
  else if (titleLen <= 12) titleFontSize = 225;
  else if (titleLen <= 18) titleFontSize = 180;
  else if (titleLen <= 24) titleFontSize = 150;
  else titleFontSize = 120;

  return (
    <BaseSlide background={{ kind: "theme", token: "gradientDark" }} padding="none">
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 80px",
          zIndex: 1,
        }}
      >
        {headerText ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 40px",
              marginBottom: 24,
              background: c.gradientGold,
              border: `2px solid ${c.accent}`,
              boxShadow: `0 6px 20px ${c.shadowDark}`,
              borderRadius: 6,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: c.onPrimary,
                letterSpacing: 6,
                textTransform: "uppercase",
              }}
            >
              {headerText}
            </span>
          </div>
        ) : null}

        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 900,
            color: c.onDark,
            lineHeight: 1.15,
            margin: "24px 0",
            textAlign: "center",
            textShadow: `0 4px 12px ${c.shadowDark}`,
            maxWidth: "100%",
            wordBreak: "keep-all",
            letterSpacing: titleFontSize > 100 ? -2 : -1,
          }}
        >
          {titleLines.map((line, index) => (
            <React.Fragment key={`${line}-${index}`}>
              {index > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: 38,
              fontWeight: 600,
              color: c.textLight,
              marginTop: 20,
              textAlign: "center",
              textShadow: `0 2px 8px ${c.shadowDark}`,
              letterSpacing: 2,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </BaseSlide>
  );
};
