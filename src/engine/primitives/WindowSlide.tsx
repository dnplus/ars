import React from "react";
import { useTheme } from "../shared/ThemeContext";
import type { Theme } from "../shared/theme";
import { BaseSlide } from "./BaseSlide";
import type { SlidePadding, WindowFrameKind, WindowSlideProps } from "./types";

const PADDING_MAP: Record<Exclude<SlidePadding, number>, number> = {
  none: 0,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
};

const LEGACY_TAG_COLOR_TOKEN_MAP = {
  blue: "info",
  green: "positive",
  purple: "highlight",
  orange: "accent",
  yellow: "warning",
  red: "negative",
  pink: "highlight",
  cyan: "info",
  slate: "secondary",
} as const satisfies Record<string, keyof Theme["colors"]>;

const resolvePadding = (padding: SlidePadding | undefined): number => {
  if (typeof padding === "number") {
    return padding;
  }

  return PADDING_MAP[padding ?? "none"];
};

const resolveTokenColor = (
  theme: Theme,
  token: keyof Theme["colors"] | undefined,
): string => {
  if (!token) {
    return theme.colors.primary;
  }

  return theme.colors[token] ?? theme.colors.primary;
};

export const normalizeLegacyTagColorToken = (
  tagColor?: string,
): keyof Theme["colors"] | undefined => {
  if (!tagColor) {
    return undefined;
  }

  return (
    LEGACY_TAG_COLOR_TOKEN_MAP[
      tagColor as keyof typeof LEGACY_TAG_COLOR_TOKEN_MAP
    ] ?? (tagColor as keyof Theme["colors"])
  );
};

type WindowChromeProps = {
  frame?: WindowFrameKind;
  title?: string;
  tag?: string;
  tagColor?: keyof Theme["colors"];
  titleSlot?: React.ReactNode;
  innerPadding?: SlidePadding;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

const WindowTag: React.FC<{
  tag?: string;
  tagColor?: keyof Theme["colors"];
  compact?: boolean;
}> = ({ tag, tagColor, compact = false }) => {
  const theme = useTheme();

  if (!tag) {
    return null;
  }

  const tone = resolveTokenColor(theme, tagColor);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "6px 12px" : "6px 16px",
        borderRadius: compact ? 10 : 12,
        border: `1px solid ${tone}`,
        color: tone,
        backgroundColor: theme.colors.surfaceCardHeader,
        fontSize: compact ? 14 : 18,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: compact ? "0.12em" : "0.08em",
        lineHeight: 1,
      }}
    >
      {tag}
    </span>
  );
};

const WindowControls: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const theme = useTheme();
  const size = compact ? 10 : 12;

  return (
    <div style={{ display: "flex", gap: compact ? 5 : 6 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: theme.colors.negative,
        }}
      />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: theme.colors.warning,
        }}
      />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: theme.colors.positive,
        }}
      />
    </div>
  );
};

export const WindowChrome: React.FC<WindowChromeProps> = ({
  frame = "mac",
  title,
  tag,
  tagColor,
  titleSlot,
  innerPadding = "none",
  children,
  style,
}) => {
  const theme = useTheme();
  const contentPadding = resolvePadding(innerPadding);

  if (frame === "none") {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: contentPadding,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  const isTerminal = frame === "terminal";
  const isSimple = frame === "simple";
  const isBrowser = frame === "browser";
  const surfaceColor = isTerminal
    ? theme.colors.surfaceCode
    : theme.colors.surfaceCard;
  const headerColor = isTerminal
    ? theme.colors.surfaceDark
    : theme.colors.surfaceCardHeader;
  const borderColor = theme.colors.border;
  const shadowColor = isTerminal
    ? theme.colors.shadowDark
    : theme.colors.shadow;
  const radius = isSimple ? 12 : 16;
  const headerPadding = isSimple ? "14px 18px" : "18px 24px";
  const resolvedTag = tag ?? (isTerminal ? "TERM" : undefined);
  const resolvedTagColor = tagColor ?? (isTerminal ? "warning" : "primary");
  const titleColor = isTerminal ? theme.colors.onDark : theme.colors.primary;

  const header = (() => {
    if (isBrowser) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: headerPadding,
            backgroundColor: headerColor,
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          <WindowControls compact />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 760,
                minHeight: 40,
                borderRadius: 999,
                padding: "8px 18px",
                border: `1px solid ${borderColor}`,
                backgroundColor: theme.colors.surfaceLight,
                color: theme.colors.onLight,
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 12,
                overflow: "hidden",
              }}
            >
              {titleSlot ?? (
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title || "about:blank"}
                </span>
              )}
            </div>
          </div>
          <WindowTag tag={resolvedTag} tagColor={resolvedTagColor} compact />
        </div>
      );
    }

    if (isSimple && !title && !resolvedTag && !titleSlot) {
      return null;
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: headerPadding,
          backgroundColor: headerColor,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: isTerminal ? 14 : 16,
          }}
        >
          {frame === "mac" || isTerminal ? <WindowControls /> : null}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {titleSlot ?? null}
            {title ? (
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: titleColor,
                  fontSize: isTerminal ? 20 : 32,
                  fontWeight: isTerminal ? 600 : 700,
                  fontFamily: isTerminal ? theme.fonts.code : theme.fonts.main,
                }}
              >
                {title}
              </span>
            ) : null}
          </div>
        </div>
        <WindowTag tag={resolvedTag} tagColor={resolvedTagColor} />
      </div>
    );
  })();

  return (
    <div
      style={{
        backgroundColor: surfaceColor,
        borderRadius: radius,
        overflow: "hidden",
        boxShadow: `0 6px 24px ${shadowColor}`,
        border: `1px solid ${borderColor}`,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {header}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          padding: contentPadding,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const WindowSlide: React.FC<WindowSlideProps> = ({
  frame = "mac",
  title,
  tag,
  tagColor,
  titleSlot,
  innerPadding = "none",
  children,
  ...baseSlideProps
}) => {
  return (
    <BaseSlide {...baseSlideProps}>
      <WindowChrome
        frame={frame}
        title={title}
        tag={tag}
        tagColor={tagColor}
        titleSlot={titleSlot}
        innerPadding={innerPadding}
      >
        {children}
      </WindowChrome>
    </BaseSlide>
  );
};
