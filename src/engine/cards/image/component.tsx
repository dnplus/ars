import React, { useState } from "react";
import { Img, staticFile } from "remotion";
import { BaseSlide, useCardContext } from "../../primitives/BaseSlide";
import { WindowSlide } from "../../primitives/WindowSlide";
import type { WindowFrameKind } from "../../primitives/types";
import type { CardRenderProps } from "../types";

export type ImageCardData = {
  src: string;
  title?: string;
  caption?: string;
  objectFit?: "cover" | "contain";
  /** Wrap in a window chrome. Omit (default) for fullscreen, no chrome, no title. */
  frame?: WindowFrameKind;
  animate?: boolean;
};

const resolveSrc = (src: string) => {
  if (src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }

  const cleanSrc = src.split("?")[0];
  return staticFile(cleanSrc.startsWith("/") ? cleanSrc.slice(1) : cleanSrc);
};

const isExplicitPlaceholder = (src: string) => {
  const normalized = src.split("?")[0].split("/").pop() ?? "";
  return normalized.startsWith("PLACEHOLDER_");
};

const toPlaceholderPath = (src: string) => {
  if (!src.trim()) return "(missing imageSrc)";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  const cleanSrc = src.split("?")[0].replace(/^\/+/, "");
  return `public/${cleanSrc}`;
};

const ImageContent: React.FC<{
  src: string;
  title?: string;
  objectFit: "cover" | "contain";
  caption?: string;
}> = ({ src, title, objectFit, caption }) => {
  const { theme } = useCardContext();
  const [hasError, setHasError] = useState(false);
  const trimmedSrc = src.trim();
  const hasSrc = trimmedSrc.length > 0;
  const finalSrc = hasSrc ? resolveSrc(trimmedSrc) : "";
  const showPlaceholder = !hasSrc || hasError || isExplicitPlaceholder(trimmedSrc);
  const placeholderLabel = title || "Image Placeholder";
  const placeholderPath = toPlaceholderPath(trimmedSrc);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: theme.colors.surfaceDark,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {showPlaceholder ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 48,
              background: `linear-gradient(135deg, ${theme.colors.surfaceDark} 0%, ${theme.colors.secondary} 100%)`,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 960,
                borderRadius: 28,
                border: `1px dashed ${theme.colors.borderLight}`,
                background: theme.colors.surfaceOverlay,
                boxShadow: `0 20px 60px ${theme.colors.shadowDark}`,
                padding: "40px 48px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: theme.colors.onCardMuted,
                  fontWeight: 700,
                }}
              >
                Placeholder
              </div>
              <div
                style={{
                  fontSize: 44,
                  lineHeight: 1.15,
                  color: theme.colors.onDark,
                  fontWeight: 700,
                }}
              >
                {placeholderLabel}
              </div>
              <div
                style={{
                  fontSize: 24,
                  lineHeight: 1.5,
                  color: theme.colors.textLight,
                  opacity: 0.92,
                }}
              >
                {hasError
                  ? "Image failed to load. Showing placeholder for Studio preview."
                  : "Image not provided yet. Showing placeholder for Studio preview."}
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: "18px 20px",
                  borderRadius: 18,
                  background: theme.colors.surfaceDark,
                  fontFamily: theme.fonts.code,
                  fontSize: 20,
                  lineHeight: 1.4,
                  color: theme.colors.accent,
                  wordBreak: "break-all",
                }}
              >
                {placeholderPath}
              </div>
            </div>
          </div>
        ) : (
          <>
            <Img
              src={finalSrc}
              onError={() => setHasError(true)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scale(1.5)",
                filter: "blur(60px)",
                opacity: 0.5,
                zIndex: 0,
              }}
            />
            <Img
              src={finalSrc}
              onError={() => setHasError(true)}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit,
                zIndex: 1,
                boxShadow: `0 10px 30px ${theme.colors.shadowDark}`,
              }}
            />
          </>
        )}
      </div>
      {showPlaceholder && caption ? (
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: theme.colors.surfaceOverlay,
            color: theme.colors.onDark,
            fontSize: 22,
            lineHeight: 1.4,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};

export const ImageCardComponent: React.FC<CardRenderProps<ImageCardData>> = ({
  data,
}) => {
  const content = (
    <ImageContent
      src={data.src}
      title={data.title}
      objectFit={data.objectFit ?? "contain"}
      caption={data.caption}
    />
  );
  const animation = data.animate === false ? { skipEnter: true } : undefined;

  if (data.frame) {
    return (
      <WindowSlide
        frame={data.frame}
        title={data.title}
        innerPadding="none"
        animation={animation}
      >
        {content}
      </WindowSlide>
    );
  }

  return (
    <BaseSlide padding="none" animation={animation}>
      {content}
    </BaseSlide>
  );
};
