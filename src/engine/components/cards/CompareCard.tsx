/**
 * @component CompareCard
 * @description Left/Right Comparison Card with staggered slide-in animations
 *
 * @agent-note
 * **Use Case**: Before/After, Pros/Cons, Plan A vs Plan B comparisons.
 * **Features**:
 * - 50/50 split with colored headers, flush aligned
 * - Left panel slides in first, right follows with delay
 * - Emoji prefix detection: items starting with emoji render icon separately at larger size
 * - Glassmorphism item cards with staggered slide-in
 * - Animated divider line (scaleY from 0 to 1)
 * - Uses Easing.out(Easing.back) for overshoot entry
 * - Dynamic font sizing via adaptiveFontSize utility
 * - Uses Surface/On-Surface theme tokens
 * - **Frame**: Defaults to 'none' (no WindowFrame wrapper).
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";
import { useTheme } from '../../shared/ThemeContext';
import { getAdaptiveFontSize, FONT_SIZE_PRESETS } from "../../shared/utils/adaptiveFontSize";

export type CompareCardProps = {
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
  leftColor?: string;
  rightColor?: string;
  cardTitle?: string;
  frame?: WindowFrameType;
};

// Detect leading emoji (emoji + optional space + rest of text)
const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u;

function parseItem(text: string): { icon: string | null; label: string } {
  const m = text.match(EMOJI_RE);
  if (m) {
    return { icon: m[0].trim(), label: text.slice(m[0].length) };
  }
  return { icon: null, label: text };
}

export const CompareCard: React.FC<CompareCardProps> = ({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
  leftColor,
  rightColor,
  cardTitle,
  frame = 'none',
}) => {
  const theme = useTheme();
  const isSlidesMode = useIsSlidesMode();
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const resolvedLeftColor = leftColor || theme.colors.negative;
  const resolvedRightColor = rightColor || theme.colors.positive;

  // Strip emojis for font sizing
  const allLabels = [...leftItems, ...rightItems].map(i => parseItem(i).label);
  const itemFontSize = getAdaptiveFontSize(allLabels, { ...FONT_SIZE_PRESETS.listItem, scale: 2 });
  const headerFontSize = getAdaptiveFontSize([leftTitle, rightTitle], { ...FONT_SIZE_PRESETS.heading, scale: 2 });

  // Panel animations — overshoot entry
  const leftProgress = isSlidesMode ? 1 : spring({
    frame: currentFrame,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.8, overshootClamping: false },
  });

  const rightProgress = isSlidesMode ? 1 : spring({
    frame: Math.max(0, currentFrame - Math.floor(fps * 0.2)),
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.8, overshootClamping: false },
  });

  // Animated divider — scaleY from 0 to 1
  const dividerProgress = isSlidesMode ? 1 : interpolate(
    currentFrame,
    [Math.floor(fps * 0.3), Math.floor(fps * 0.8)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Per-item stagger — slower for more drama
  const getItemProgress = (index: number, isRight: boolean) => {
    if (isSlidesMode) return 1;
    const baseDelay = isRight ? fps * 0.4 : fps * 0.25;
    const itemDelay = baseDelay + index * Math.floor(fps * 0.1);
    return spring({
      frame: Math.max(0, currentFrame - itemDelay),
      fps,
      config: { damping: 14, stiffness: 140, mass: 0.6, overshootClamping: false },
    });
  };

  const panelStyle = (progress: number, fromLeft: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    opacity: interpolate(progress, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `translateX(${interpolate(progress, [0, 1], [fromLeft ? -50 : 50, 0])}px) scale(${interpolate(progress, [0, 1], [0.95, 1])})`,
  });

  const headerStyle = (color: string): React.CSSProperties => ({
    padding: '28px 36px',
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: theme.colors.onPrimary,
    fontSize: headerFontSize,
    fontWeight: 700,
    fontFamily: theme.fonts.main,
    textAlign: 'center' as const,
    letterSpacing: '0.02em',
  });

  const maxItems = Math.max(leftItems.length, rightItems.length);
  const itemsContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: '20px 24px',
    display: 'grid',
    gridTemplateRows: `repeat(${maxItems}, 1fr)`,
    gap: 14,
    background: theme.colors.surfaceCard,
    alignContent: 'center',
  };

  const renderItem = (item: string, index: number, isRight: boolean) => {
    const progress = getItemProgress(index, isRight);
    const { icon, label } = parseItem(item);
    const slideX = interpolate(progress, [0, 1], [isRight ? 30 : -30, 0]);
    const itemOpacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const itemScale = interpolate(progress, [0, 1], [0.9, 1]);

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: icon ? 16 : 12,
          opacity: itemOpacity,
          transform: `translateX(${slideX}px) scale(${itemScale})`,
          fontSize: itemFontSize,
          lineHeight: 1.4,
          color: theme.colors.onCard,
          fontFamily: theme.fonts.main,
          // Glassmorphism item background
          background: `${theme.colors.surfaceCard}66`,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          borderRadius: 12,
          padding: icon ? '14px 20px' : '12px 18px',
          border: `1px solid ${theme.colors.borderLight}40`,
        }}
      >
        {icon ? (
          <span style={{
            fontSize: Math.round(itemFontSize * 1.6),
            lineHeight: 1,
            flexShrink: 0,
          }}>{icon}</span>
        ) : (
          <span style={{
            marginTop: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: isRight ? resolvedRightColor : resolvedLeftColor,
            flexShrink: 0,
            boxShadow: `0 0 8px ${isRight ? resolvedRightColor : resolvedLeftColor}60`,
          }} />
        )}
        <span style={{ fontWeight: 600 }}>{label}</span>
      </div>
    );
  };

  return (
    <BaseCard
      frame={frame}
      frameTitle={cardTitle || 'Comparison'}
      frameTag="VS"
      frameTagColor="purple"
      padding="none"
    >
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 0,
        alignItems: 'stretch',
      }}>
        {/* Left Panel */}
        <div style={panelStyle(leftProgress, true)}>
          <div style={headerStyle(resolvedLeftColor)}>{leftTitle}</div>
          <div style={itemsContainerStyle}>
            {leftItems.map((item, i) => renderItem(item, i, false))}
          </div>
        </div>

        {/* Animated Divider */}
        <div style={{
          width: 2,
          background: `linear-gradient(to bottom, transparent, ${theme.colors.borderLight}, transparent)`,
          alignSelf: 'stretch',
          transformOrigin: 'top',
          transform: `scaleY(${dividerProgress})`,
          opacity: dividerProgress,
        }} />

        {/* Right Panel */}
        <div style={panelStyle(rightProgress, false)}>
          <div style={headerStyle(resolvedRightColor)}>{rightTitle}</div>
          <div style={itemsContainerStyle}>
            {rightItems.map((item, i) => renderItem(item, i, true))}
          </div>
        </div>
      </div>
    </BaseCard>
  );
};
