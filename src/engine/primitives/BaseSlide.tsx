import React, { createContext, useContext } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTheme } from "../shared/ThemeContext";
import type { Theme } from "../shared/theme";
import type { BaseSlideProps, SlidePadding } from "./types";

export type CardContext = {
  theme: Theme;
  frame: number;
  fps: number;
  progress: number;
};

const CardContextValue = createContext<CardContext | null>(null);

const PADDING_MAP: Record<Exclude<SlidePadding, number>, number> = {
  none: 0,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
};

const resolvePadding = (padding: SlidePadding | undefined): number => {
  if (typeof padding === "number") {
    return padding;
  }

  return PADDING_MAP[padding ?? "none"];
};

const resolveBackgroundStyle = (
  theme: Theme,
  background: BaseSlideProps["background"],
): React.CSSProperties => {
  if (!background) {
    return {};
  }

  if (background.kind === "theme") {
    return {
      background: theme.colors[background.token],
    };
  }

  if (background.kind === "color") {
    return {
      background: background.value,
    };
  }

  return {};
};

export const useCardContext = (): CardContext => {
  const context = useContext(CardContextValue);

  if (!context) {
    throw new Error("useCardContext must be used inside BaseSlide.");
  }

  return context;
};

export const BaseSlide: React.FC<BaseSlideProps> = ({
  children,
  background,
  animation,
  padding = "none",
  style,
  align,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const enterOpacity = animation?.skipEnter
    ? 1
    : interpolate(frame, [0, 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const contextValue: CardContext = {
    theme,
    frame,
    fps,
    progress,
  };
  const paddingValue = resolvePadding(padding);
  const backgroundStyle = resolveBackgroundStyle(theme, background);

  return (
    <CardContextValue.Provider value={contextValue}>
      <AbsoluteFill
        style={{
          ...backgroundStyle,
          ...style,
          opacity: enterOpacity,
          overflow: "hidden",
          fontFamily: theme.fonts.main,
        }}
      >
        {background?.kind === "node" ? (
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            {background.render()}
          </AbsoluteFill>
        ) : null}
        <AbsoluteFill
          style={{
            padding: paddingValue,
            display: "flex",
            flexDirection: "column",
            justifyContent: align?.justifyContent ?? "flex-start",
            alignItems: align?.alignItems ?? "stretch",
            textAlign: align?.textAlign,
            overflow: "hidden",
          }}
        >
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
    </CardContextValue.Provider>
  );
};
