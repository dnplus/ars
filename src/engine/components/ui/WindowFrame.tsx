/**
 * @component WindowFrame
 * @description 獨立的視窗框架組件，支援多種風格
 *
 * 框架類型：
 * - 'mac': Mac 風格紅黃綠交通燈 + 標題欄
 * - 'terminal': 終端機風格（未來擴充）
 * - 'none': 無框架，直接渲染內容
 */
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { useTheme } from '../../shared/ThemeContext';

export type WindowFrameType = 'mac' | 'terminal' | 'none' | 'simple';

export type WindowFrameProps = {
  type?: WindowFrameType;
  title?: string;
  tag?: string;
  tagColor?: string;
  children: React.ReactNode;
  animate?: boolean;
};

const tagColorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: "#dbeafe", text: "#1d4ed8" },
  green: { bg: "#dcfce7", text: "#15803d" },
  purple: { bg: "#f3e8ff", text: "#7e22ce" },
  orange: { bg: "#ffedd5", text: "#c2410c" },
  yellow: { bg: "#fef9c3", text: "#a16207" },
  red: { bg: "#fee2e2", text: "#dc2626" },
  pink: { bg: "#fce7f3", text: "#be185d" },
  cyan: { bg: "#cffafe", text: "#0891b2" },
  slate: { bg: "#e2e8f0", text: "#475569" },
};

export const WindowFrame: React.FC<WindowFrameProps> = ({
  type = 'mac',
  title = '',
  tag = 'INFO',
  tagColor = 'blue',
  children,
  animate = true,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation: Slide Up + Fade In
  const slideIn = animate
    ? interpolate(frame, [fps * 0.3, fps * 0.6], [20, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    : 0;

  const opacity = animate
    ? interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    : 1;

  const colors = tagColorMap[tagColor] || tagColorMap.slate;

  // 無框架模式：直接渲染內容
  if (type === 'none') {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${slideIn}px)`,
          opacity,
        }}
      >
        {children}
      </div>
    );
  }

  // Mac 風格框架
  if (type === 'mac') {
    return (
      <div
        style={{
          backgroundColor: theme.colors.surfaceCard,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 4px 20px ${theme.colors.shadow}`,
          border: `1px solid ${theme.colors.border}`,
          transform: `translateY(${slideIn}px)`,
          opacity,
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header / Title Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 28px",
            backgroundColor: theme.colors.surfaceCardHeader,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Mac-style window controls decoration */}
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#eab308" }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
            </div>

            <span style={{ fontWeight: 700, fontSize: 32, color: theme.colors.primary, marginLeft: 16 }}>
              {title}
            </span>
          </div>

          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "6px 16px",
              borderRadius: 8,
              backgroundColor: colors.bg,
              color: colors.text,
            }}
          >
            {tag}
          </span>
        </div>

        {/* Content Container */}
        <div
          style={{
            flex: 1,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Simple 風格框架 (no header, just rounded container)
  if (type === 'simple') {
    return (
      <div
        style={{
          backgroundColor: theme.colors.surfaceCard,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: `0 2px 8px ${theme.colors.shadow}`,
          border: `1px solid ${theme.colors.border}`,
          transform: `translateY(${slideIn}px)`,
          opacity,
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    );
  }

  // Terminal 風格框架（預留擴充）
  if (type === 'terminal') {
    return (
      <div
        style={{
          backgroundColor: theme.colors.surfaceCode,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: `0 4px 20px ${theme.colors.shadowDark}`,
          border: `1px solid ${theme.colors.border}`,
          transform: `translateY(${slideIn}px)`,
          opacity,
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            backgroundColor: theme.colors.surfaceCode,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27c93f" }} />
          </div>
          <span style={{ marginLeft: 16, color: theme.colors.onCardMuted, fontSize: 14, fontFamily: "monospace" }}>
            {title || 'terminal'}
          </span>
        </div>

        {/* Content Container */}
        <div
          style={{
            flex: 1,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Fallback
  return <>{children}</>;
};
