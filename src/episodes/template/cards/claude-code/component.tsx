import React from "react";
import { BaseSlide } from "../../../../engine/primitives/BaseSlide";
import { WindowChrome } from "../../../../engine/primitives/WindowSlide";
import { useTheme } from "../../../../engine/shared/ThemeContext";
import type { CardRenderProps } from "../../../../engine/cards/types";
import type { ClaudeCodeData } from "./schema";

const LINE_STYLE_MAP = {
  prompt: {
    prefix: "❯ ",
    colorToken: "primary",
  },
  command: {
    prefix: "$ ",
    colorToken: "onDark",
  },
  output: {
    prefix: "  ",
    colorToken: "onCardMuted",
  },
  success: {
    prefix: "✓ ",
    colorToken: "positive",
  },
  error: {
    prefix: "✗ ",
    colorToken: "negative",
  },
  info: {
    prefix: "ℹ ",
    colorToken: "highlight",
  },
} as const;

export const ClaudeCodeComponent: React.FC<CardRenderProps<ClaudeCodeData>> = ({
  data,
}) => {
  const theme = useTheme();

  return (
    <BaseSlide
      background={{ kind: "theme", token: "surfaceDark" }}
      padding="none"
      align={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          maxWidth: 1440,
          maxHeight: 860,
          padding: 48,
          boxSizing: "border-box",
        }}
      >
        <WindowChrome
          frame="terminal"
          title={data.title ?? "Claude Code"}
          tag={data.tag ?? "CLI"}
          style={{ height: "100%" }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              height: "100%",
              padding: "34px 38px",
              boxSizing: "border-box",
              fontFamily: theme.fonts.code,
              fontSize: 22,
              lineHeight: 1.7,
            }}
          >
            {data.lines.map((line, index) => {
              const style = LINE_STYLE_MAP[line.type];
              const color = theme.colors[style.colorToken];

              return (
                <div
                  key={`${line.type}-${index}-${line.text}`}
                  style={{
                    color,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  <span>{style.prefix}</span>
                  <span>{line.text}</span>
                </div>
              );
            })}
          </div>
        </WindowChrome>
      </div>
    </BaseSlide>
  );
};
