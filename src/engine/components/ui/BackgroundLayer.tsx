/**
 * @component BackgroundLayer
 * @description 根據 BackgroundPreset 渲染動態背景效果
 *
 * @agent-note
 * 在 StreamingLayout 最底層渲染。每個 preset 用純 CSS gradients + interpolate 動畫。
 * gradient-mesh 和 aurora 使用 sine 波持續運動（永不靜止）。
 *
 * 可用預設：
 * - `default`: 深咖啡漸層 (theme.gradientDark)
 * - `gradient-mesh`: 多色 radial-gradient 疊加，持續漂浮
 * - `aurora`: 柔和極光色帶 + 呼吸式位移
 * - `spotlight`: 中心高光 + 暗邊 vignette，光源微動
 * - `minimal`: 純深色 + 細微噪點紋理
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useTheme } from '../../shared/ThemeContext';
import type { BackgroundPreset } from '../../shared/types';

interface BackgroundLayerProps {
  preset?: BackgroundPreset;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ preset = 'default' }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  };

  switch (preset) {
    case 'gradient-mesh': {
      // Continuous sine-wave driven mesh — uses theme colors
      const x1 = 50 + 30 * Math.sin(time * 0.15);
      const y1 = 50 + 25 * Math.cos(time * 0.12);
      const x2 = 50 + 25 * Math.cos(time * 0.18);
      const y2 = 50 + 30 * Math.sin(time * 0.1);
      const x3 = 50 + 20 * Math.sin(time * 0.08 + 1.5);
      const y3 = 50 + 20 * Math.cos(time * 0.13 + 0.8);
      return (
        <AbsoluteFill>
          <div style={{
            ...baseStyle,
            background: `
              radial-gradient(ellipse at ${x1}% ${y1}%, ${theme.colors.primary}30 0%, transparent 50%),
              radial-gradient(ellipse at ${x2}% ${y2}%, ${theme.colors.accent}25 0%, transparent 50%),
              radial-gradient(ellipse at ${x3}% ${y3}%, ${theme.colors.secondary}20 0%, transparent 60%),
              ${theme.colors.gradientDark}
            `,
          }} />
        </AbsoluteFill>
      );
    }

    case 'aurora': {
      // Breathing aurora bands — uses theme colors
      const y1 = 45 + 15 * Math.sin(time * 0.1);
      const y2 = 50 + 12 * Math.cos(time * 0.13 + 1.0);
      const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });
      return (
        <AbsoluteFill>
          <div style={{
            ...baseStyle,
            opacity,
            background: `
              linear-gradient(180deg,
                transparent ${y1 - 20}%,
                ${theme.colors.primary}18 ${y1}%,
                ${theme.colors.accent}15 ${y1 + 10}%,
                transparent ${y1 + 25}%
              ),
              linear-gradient(180deg,
                transparent ${y2 - 15}%,
                ${theme.colors.secondary}15 ${y2}%,
                ${theme.colors.primary}12 ${y2 + 12}%,
                transparent ${y2 + 20}%
              ),
              ${theme.colors.gradientDark}
            `,
          }} />
        </AbsoluteFill>
      );
    }

    case 'spotlight': {
      // Spotlight with subtle breathing movement
      const glowSize = 35 + 5 * Math.sin(time * 0.3);
      const spotX = 50 + 2 * Math.sin(time * 0.15);
      const spotY = 45 + 2 * Math.cos(time * 0.12);
      return (
        <AbsoluteFill>
          <div style={{
            ...baseStyle,
            background: `
              radial-gradient(ellipse at ${spotX}% ${spotY}%, color-mix(in srgb, ${theme.colors.primary} 15%, transparent) 0%, transparent ${glowSize}%),
              radial-gradient(ellipse at 50% 50%, ${theme.colors.surfaceDark} 40%, color-mix(in srgb, ${theme.colors.surfaceDark} 65%, black) 100%),
              ${theme.colors.surfaceDark}
            `,
          }} />
        </AbsoluteFill>
      );
    }

    case 'minimal': {
      // Pure dark with subtle noise-like texture
      return (
        <AbsoluteFill>
          <div style={{
            ...baseStyle,
            background: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                color-mix(in srgb, ${theme.colors.onDark} 1%, transparent) 2px,
                color-mix(in srgb, ${theme.colors.onDark} 1%, transparent) 4px
              ),
              ${theme.colors.surfaceDark}
            `,
          }} />
        </AbsoluteFill>
      );
    }

    case 'default':
    default: {
      return (
        <AbsoluteFill>
          <div style={{
            ...baseStyle,
            background: theme.colors.gradientDark,
          }} />
        </AbsoluteFill>
      );
    }
  }
};
