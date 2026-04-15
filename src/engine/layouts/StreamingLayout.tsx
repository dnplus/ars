/**
 * @layout StreamingLayout
 * @description Standard 16:9 Live-Streaming UI Shell
 * 
 * @agent-note
 * This is the **Default Layout** for most long-form content.
 * **Structure:**
 * - **Content Box** (Left): Renders the `children` (usually `WebinarScene` output).
 * - **VTuber Slot** (Right): Renders `<AnimatedVTuber>` driven by audio.
 * - **Subtitle Slot** (Bottom): Renders `<SubtitleOverlay>`.
 * 
 * **Modes (`layoutMode`) Support:**
 * - `title-card`: Shows bordered content box + VTuber.
 * - `card-only`: Shows unbordered content box (for full-card visuals) + VTuber.
 * - `fullscreen`: Content fills 100% (video), VTuber fades out to avoid occlusion.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { useTheme } from '../shared/ThemeContext';
import { AnimatedVTuber } from "../components/ui/AnimatedVTuber";
import { SubtitleOverlay } from "../components/ui/SubtitleOverlay";
import { BackgroundLayer } from "../components/ui/BackgroundLayer";
import { type SubtitlePhrase } from "../shared/subtitle";
import { type LayoutMode, type BackgroundPreset } from "../shared/types";

export type StreamingLayoutConfig = {
  // VTuber 設定
  vtuber: {
    enabled: boolean;
    closedImg?: string;  // public/ 路徑，非必填，若不填寫則隱藏人物
    openImg?: string;
    volumeThreshold?: number;
    width?: number;
    height?: number;
  };

  // 字幕設定
  subtitle: {
    enabled: boolean;
    style?: 'bottom-center' | 'bottom-left' | 'bottom-right';
    fontSize?: number;
    background?: string;
  };


};

export type StreamingLayoutProps = {
  config: StreamingLayoutConfig;
  children: React.ReactNode;  // Scene 渲染結果
  audioSrc?: string;
  narration?: string;
  /** Whisper 生成的字幕時間戳（優先於均勻分段） */
  subtitles?: SubtitlePhrase[];
  /** 右側垂直裝飾文字（省略則不顯示） */
  decorationText?: string;
  /** 佈局模式：title-card（預設）| card-only | fullscreen */
  layoutMode?: LayoutMode;
  /** 前一個 step 的 layoutMode（用於過場動畫） */
  prevLayoutMode?: LayoutMode;
  /** 背景預設 */
  backgroundPreset?: BackgroundPreset;
};

export const StreamingLayout: React.FC<StreamingLayoutProps> = ({
  config,
  children,
  audioSrc,
  narration,
  subtitles,
  decorationText,
  layoutMode = 'title-card',
  prevLayoutMode,
  backgroundPreset,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 是否顯示 VTuber (enabled 且有提供圖片路徑)
  const showVTuber = config.vtuber.enabled && !!config.vtuber.closedImg && !!config.vtuber.openImg;

  // VTuber 過場動畫（zoom 效果）
  // - fullscreen 模式：zoomout（1 -> 0.8）+ fadeout
  // - 從 fullscreen 切回其他模式：zoomin（0.8 -> 1）+ fadein
  // - 其他情況：保持正常
  const isFullscreen = layoutMode === 'fullscreen';
  const wasFullscreen = prevLayoutMode === 'fullscreen';

  let vtuberOpacity = 1;
  let vtuberScale = 1;

  if (isFullscreen) {
    if (wasFullscreen) {
      // 已經是 fullscreen，保持隱藏狀態
      vtuberOpacity = 0;
      vtuberScale = 0.7;
    } else {
      // 從非 fullscreen 進入 fullscreen：zoomout + fadeout
      vtuberOpacity = interpolate(frame, [0, fps * 0.4], [1, 0], { extrapolateRight: 'clamp' });
      vtuberScale = interpolate(frame, [0, fps * 0.4], [1, 0.7], { extrapolateRight: 'clamp' });
    }
  } else if (wasFullscreen) {
    // 從 fullscreen 離開：zoomin + fadein
    vtuberOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: 'clamp' });
    vtuberScale = interpolate(frame, [0, fps * 0.4], [0.7, 1], { extrapolateRight: 'clamp' });
  }

  // Content Box 樣式根據 layoutMode 調整
  // - fullscreen 模式：完全滿版，無 margin、無邊框
  // - card-only 模式：標準位置，無邊框（卡片自帶框架）
  // - title-card 模式：標準位置，有邊框
  const isCardOnly = layoutMode === 'card-only';
  const contentBoxStyle: React.CSSProperties = isFullscreen
    ? {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 0,
      overflow: "hidden",
      border: 'none',
      boxShadow: 'none',
      display: "flex",
      flexDirection: "column" as const,
    }
    : {
      position: "absolute" as const,
      top: 32,
      left: 32,
      right: showVTuber ? "8%" : 100, // 從 12% 改為 10%，給內容更多空間
      bottom: 32,
      borderRadius: 16,
      overflow: "hidden",
      border: isCardOnly ? 'none' : `2px solid ${theme.colors.border}`,
      boxShadow: isCardOnly ? 'none' : `8px 8px 24px ${theme.colors.shadowDark}`,
      display: "flex",
      flexDirection: "column" as const,
    };

  return (
    <AbsoluteFill
      style={{
        fontFamily: theme.fonts.main,
      }}
    >
      {/* 動態背景層 */}
      <BackgroundLayer preset={backgroundPreset} />
      {/* 內容框 */}
      <div style={contentBoxStyle}>
        {children}
      </div>

      {/* 右側裝飾文字 - 與 VTuber 縮放邏輯一致，但獨立顯示 */}
      <div
        style={{
          position: "absolute",
          top: "0%",
          right: 32,
          bottom: "35%",
          width: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5,
          pointerEvents: "none",
          opacity: vtuberOpacity,
          transform: `scale(${vtuberScale})`,
        }}
      >
        <div
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            fontSize: 40,
            fontWeight: 900,
            color: theme.colors.borderLight,
            fontFamily: theme.fonts.main,
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          {decorationText}
        </div>
      </div>

      {/* VTuber Overlay */}
      {showVTuber && audioSrc && (
        <div
          style={{
            position: "absolute",
            right: -60, // 負 margin 抵消圖片本身的透明邊距
            bottom: -20,
            zIndex: 10,
            opacity: vtuberOpacity,
            transform: `scale(${vtuberScale})`,
            transformOrigin: "bottom right",
          }}
        >
          <AnimatedVTuber
            mouthClosedSrc={config.vtuber.closedImg!}
            mouthOpenSrc={config.vtuber.openImg!}
            audioSrc={audioSrc}
            volumeThreshold={config.vtuber.volumeThreshold || 0.02}
            width={config.vtuber.width || 462}
            height={config.vtuber.height || 462}
          />
        </div>
      )}

      {/* 字幕 Overlay */}
      {config.subtitle.enabled && narration && audioSrc && (
        <SubtitleOverlay
          text={narration}
          subtitles={subtitles}
          containerStyle={{
            paddingBottom: '2%',
          }}
          style={{
            maxWidth: "90%",
            fontSize: config.subtitle.fontSize || 43,
            fontFamily: theme.fonts.main,
            background: config.subtitle.background || `${theme.colors.surfaceDark}88`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
