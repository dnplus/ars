/**
 * @component TimelineCard
 * @description Premium horizontal timeline — large gradient markers with glow,
 * animated connecting line, no outer frame.
 *
 * @agent-note
 * - Markers ARE the primary visual (no glassmorphism content cards)
 * - Thick animated connecting line with gradient
 * - Adaptive sizing: fewer items → bigger markers + bigger text
 * - Recommended: 3-5 items for best visual impact
 * - Spring overshoot entry with stagger
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";
import { useTheme } from '../../shared/ThemeContext';

export type TimelineItem = {
  /** Node title */
  title: string;
  /** Optional description text */
  description?: string;
  /** Emoji icon for the node marker (default: numbered) */
  icon?: string;
};

export type TimelineCardProps = {
  items: TimelineItem[];
  cardTitle?: string;
  frame?: WindowFrameType;
};

export const TimelineCard: React.FC<TimelineCardProps> = ({
  items,
  cardTitle,
  frame = 'none',
}) => {
  const theme = useTheme();
  const isSlidesMode = useIsSlidesMode();
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = items.length;

  // Adaptive sizing (card area ~1735×1016, 3 cols = ~578px each)
  const markerSize = count <= 3 ? 140 : count <= 4 ? 110 : 90;
  const iconSize = count <= 3 ? 60 : count <= 4 ? 48 : 40;
  const titleSize = count <= 3 ? 34 : count <= 4 ? 28 : 24;
  const descSize = count <= 3 ? 22 : count <= 4 ? 18 : 16;
  const lineHeight = count <= 3 ? 8 : count <= 4 ? 6 : 5;

  // Horizontal line progress (~2.5s)
  const lineDuration = fps * 2.5;
  const lineProgress = isSlidesMode ? 1 : interpolate(
    currentFrame,
    [Math.floor(fps * 0.2), Math.floor(fps * 0.2) + lineDuration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Per-node staggering (~0.6s apart, slower spring)
  const getNodeProgress = (index: number) => {
    if (isSlidesMode) return 1;
    const delay = Math.floor(fps * 0.4) + index * Math.floor(fps * 0.6);
    return spring({
      frame: Math.max(0, currentFrame - delay),
      fps,
      config: { damping: 14, stiffness: 60, mass: 1.2, overshootClamping: false },
    });
  };

  return (
    <BaseCard
      frame={frame}
      frameTitle={cardTitle || 'Timeline'}
      frameTag="TIMELINE"
      frameTagColor="blue"
      padding="none"
    >
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '20px 32px',
        overflow: 'hidden',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Horizontal timeline track */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-around',
          paddingTop: markerSize / 2,
        }}>
          {/* Connecting line behind markers */}
          <div style={{
            position: 'absolute',
            top: markerSize / 2 + markerSize / 2 - lineHeight / 2,
            left: 0,
            right: 0,
            height: lineHeight,
            background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.accent})`,
            transformOrigin: 'left',
            transform: `scaleX(${lineProgress})`,
            opacity: 0.7,
            borderRadius: lineHeight / 2,
            boxShadow: `0 0 12px ${theme.colors.primary}60, 0 0 32px ${theme.colors.primary}30`,
          }} />

          {/* Nodes */}
          {items.map((item, index) => {
            const progress = getNodeProgress(index);
            const opacity = interpolate(progress, [0, 0.3], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            const translateY = interpolate(progress, [0, 1], [30, 0]);
            const scale = interpolate(progress, [0, 1], [0.4, 1]);

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  opacity,
                  transform: `translateY(${translateY}px)`,
                }}
              >
                {/* Marker — large gradient circle with glow */}
                <div style={{
                  width: markerSize,
                  height: markerSize,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: item.icon ? iconSize : iconSize * 0.7,
                  fontWeight: 700,
                  color: theme.colors.onPrimary,
                  fontFamily: theme.fonts.main,
                  transform: `scale(${scale})`,
                  boxShadow: `0 0 0 3px ${theme.colors.shadow}, 0 0 20px ${theme.colors.primary}60, 0 0 48px ${theme.colors.primary}30`,
                  flexShrink: 0,
                }}>
                  {item.icon || (index + 1)}
                </div>

                {/* Title directly below marker */}
                <div style={{
                  textAlign: 'center',
                  maxWidth: '90%',
                  marginTop: count <= 3 ? 24 : 18,
                }}>
                  <div style={{
                    fontSize: titleSize,
                    fontWeight: 700,
                    color: theme.colors.onCard,
                    fontFamily: theme.fonts.main,
                    lineHeight: 1.3,
                    marginBottom: item.description ? 6 : 0,
                  }}>
                    {item.title}
                  </div>
                  {item.description && (
                    <div style={{
                      fontSize: descSize,
                      color: theme.colors.onCardMuted,
                      fontFamily: theme.fonts.main,
                      lineHeight: 1.4,
                      fontWeight: 400,
                    }}>
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseCard>
  );
};
