import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BaseSlide, useCardContext } from "../../primitives/BaseSlide";
import { getCharStyle, splitIntoChars } from "../../shared/animations/kineticText";
import { useTheme } from "../../shared/ThemeContext";
import type { CardRenderProps } from "../types";

export type TickerCardData = {
  content: string;
  title?: string;
  scale?: number;
  style?: "flash" | "kinetic";
};

const TickerLine: React.FC<{
  line: string;
  lineProgress: number;
  fontSize: number;
  styleMode: "flash" | "kinetic";
}> = ({ line, lineProgress, fontSize, styleMode }) => {
  const { theme, fps } = useCardContext();
  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight: 900,
    lineHeight: 1.2,
    color: theme.colors.onDark,
    textShadow: `0 12px 32px ${theme.colors.shadowDark}`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    maxWidth: "100%",
  };

  if (styleMode === "kinetic") {
    const chars = splitIntoChars(line);

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {chars.map((char, index) => (
          <span
            key={`${line}-${index}`}
            style={{
              ...getCharStyle(index, chars.length, lineProgress, fps),
              ...textStyle,
              lineHeight: 1.05,
              whiteSpace: "pre",
              overflowWrap: "normal",
              wordBreak: "normal",
            }}
          >
            {char}
          </span>
        ))}
      </div>
    );
  }

  const characters = Array.from(line);
  const visibleCount = Math.max(
    0,
    Math.floor(interpolate(lineProgress, [0, 1], [0, characters.length])),
  );
  const visibleText = characters.slice(0, visibleCount).join("");
  const showCursor = lineProgress < 1;

  return (
    <div
      style={textStyle}
    >
      {visibleText}
      {showCursor ? (
        <span
          style={{
            color: theme.colors.warning,
            marginLeft: 6,
          }}
        >
          |
        </span>
      ) : null}
    </div>
  );
};

export const TickerCardComponent: React.FC<CardRenderProps<TickerCardData>> = ({
  data,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const lines = data.content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const timePerLine = 1 / lines.length;
  const rawIndex = Math.floor(progress * lines.length);
  const currentIndex = Math.min(rawIndex, lines.length - 1);
  const segmentStart = currentIndex * timePerLine;
  const segmentAnimateEnd = segmentStart + timePerLine * 0.85;
  const lineProgress = interpolate(progress, [segmentStart, segmentAnimateEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = Math.max(76, Math.round(108 * (data.scale ?? 1)));

  return (
    <BaseSlide
      background={{ kind: "theme", token: "gradientDark" }}
      padding="xl"
      align={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {data.title ? (
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 40,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: theme.colors.warning,
          }}
        >
          {data.title}
        </div>
      ) : null}
      <div
        style={{
          width: "100%",
          height: "100%",
          maxWidth: 1480,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 80px",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <TickerLine
          line={lines[currentIndex]}
          lineProgress={lineProgress}
          fontSize={fontSize}
          styleMode={data.style ?? "flash"}
        />
      </div>
    </BaseSlide>
  );
};
