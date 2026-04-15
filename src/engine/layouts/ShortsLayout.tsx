/**
 * @layout ShortsLayout
 * @description Vertical 9:16 Mobile-First UI Shell
 * 
 * @agent-note
 * **Use Case**: YouTube Shorts / TikTok / Reels.
 * **Structure:**
 * - **Top**: Topic Code (#HashTag).
 * - **Middle** (Content Box): Compact container for `WebinarScene` output.
 * - **Bottom**: VTuber extends to screen bottom, subtitles overlay on top of VTuber.
 * 
 * **Constraint**:
 * - Content is much narrower. Ensure inner Cards (`TickerCard`, `InfoCard`) are responsive.
 */

import React from "react";
import { AbsoluteFill } from "remotion";
import { useTheme } from '../shared/ThemeContext';
import { AnimatedVTuber } from "../components/ui/AnimatedVTuber";
import { SubtitleOverlay } from "../components/ui/SubtitleOverlay";
import { StreamingLayoutProps } from "./StreamingLayout";

export const ShortsLayout: React.FC<StreamingLayoutProps> = ({
  config,
  children,
  audioSrc,
  narration,
  subtitles,
  decorationText,
  layoutMode = 'title-card',
  backgroundPreset,
}) => {
  const theme = useTheme();
  const isFullscreen = layoutMode === 'fullscreen';

  // liveScene uses shared background from Composition level
  const isLiveScene = (backgroundPreset as string) === 'live-scene';

  // 1. 背景 - liveScene 時透明，否則使用 Cream/Beige
  const containerStyle: React.CSSProperties = {
    fontFamily: theme.fonts.main,
    background: isLiveScene ? 'transparent' : theme.colors.surfaceLight,
  };

  // 2. 內容框 (Card Container)
  const contentBoxStyle: React.CSSProperties = isFullscreen
    ? {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    }
    : {
      position: "absolute",
      top: 192,
      left: 0,
      right: 0,
      height: 672,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "stretch",
      zIndex: 1,
    };

  // 3. 頂部裝飾 (Topic Code) - 全螢幕時隱藏
  const headerStyle: React.CSSProperties = {
    position: "absolute",
    top: 70,
    left: 0,
    width: "100%",
    textAlign: "center",
    fontSize: 56,
    fontWeight: 900,
    color: isLiveScene ? theme.colors.onDark : theme.colors.onLight,
    letterSpacing: "0.1em",
    opacity: isFullscreen ? 0 : 1,
    zIndex: 2,
    textShadow: isLiveScene ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
  };

  // 是否顯示 VTuber (enabled 且有提供圖片路徑)
  const showVTuber = config.vtuber.enabled && !!config.vtuber.closedImg && !!config.vtuber.openImg;

  const vtuberWidth = config.vtuber.width || 800;
  const vtuberHeight = config.vtuber.height || 800;

  return (
    <AbsoluteFill style={{ ...containerStyle, overflow: 'visible' }}>
      {/* Header */}
      {!isFullscreen && (
        <div style={headerStyle}>
          {decorationText ? `#${decorationText}` : '#Shorts'}
        </div>
      )}

      {/* 內容區域 */}
      <div style={contentBoxStyle}>
        {children}
      </div>

      {/* VTuber — 延伸到螢幕底部（無音訊時靜態顯示） */}
      {!isFullscreen && showVTuber && (
        <div
          style={{
            position: "absolute",
            bottom: 296,
            left: "50%",
            transform: "translateX(-50%)",
            width: vtuberWidth,
            zIndex: 10,
            overflow: "visible",
          }}
        >
          <AnimatedVTuber
            mouthClosedSrc={config.vtuber.closedImg!}
            mouthOpenSrc={config.vtuber.openImg!}
            audioSrc={audioSrc}
            volumeThreshold={config.vtuber.volumeThreshold || 0.02}
            width={vtuberWidth}
            height={vtuberHeight}
          />
        </div>
      )}



      {/* 字幕 — 疊在 VTuber 上面 */}
      {config.subtitle.enabled && narration && audioSrc && (
        <SubtitleOverlay
          text={narration}
          subtitles={subtitles}
          containerStyle={{
            paddingBottom: isFullscreen ? '10%' : '19%',
          }}
          style={{
            maxWidth: "90%",
            fontSize: 56,
            background: theme.colors.surfaceOverlay,
            padding: "24px 32px",
            borderRadius: 16,
            fontWeight: "bold",
            color: theme.colors.onDark,
            boxShadow: `0 4px 12px ${theme.colors.shadowDark}`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
