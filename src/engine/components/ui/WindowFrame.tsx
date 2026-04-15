import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";
import {
  WindowChrome,
  normalizeLegacyTagColorToken,
} from "../../primitives/WindowSlide";
import type { WindowFrameKind } from "../../primitives/types";

export type WindowFrameType = WindowFrameKind;

export type WindowFrameProps = {
  type?: WindowFrameType;
  title?: string;
  tag?: string;
  tagColor?: string;
  children: React.ReactNode;
  animate?: boolean;
};

export const WindowFrame: React.FC<WindowFrameProps> = ({
  type = "mac",
  title = "",
  tag = "INFO",
  tagColor = "blue",
  children,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isStatic = useIsSlidesMode();
  const shouldAnimate = animate && !isStatic;
  const slideIn = shouldAnimate
    ? interpolate(frame, [fps * 0.3, fps * 0.6], [20, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const opacity = shouldAnimate
    ? interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <WindowChrome
      frame={type}
      title={title}
      tag={tag}
      tagColor={normalizeLegacyTagColorToken(tagColor)}
      style={{
        transform: `translateY(${slideIn}px)`,
        opacity,
      }}
    >
      {children}
    </WindowChrome>
  );
};
