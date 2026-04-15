/**
 * @component StatsCard
 * @description Premium KPI card — big ring gauge per number, no outer frame.
 *
 * @agent-note
 * - SVG ring gauge IS the container (no extra glassmorphism box)
 * - Thick stroke (12-16px) with glow
 * - Recommended: 3 stats max for best visual impact
 * - Bouncy count-up + damped bounce on landing
 * - Adaptive sizing: fewer stats → bigger rings + bigger numbers
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";
import { useTheme } from '../../shared/ThemeContext';

export type StatItem = {
  value: string;
  label: string;
  prefix?: string;
  suffix?: string;
};

export type StatsCardProps = {
  stats: StatItem[];
  cardTitle?: string;
  frame?: WindowFrameType;
};

function parseNumericValue(val: string): { num: number; unitSuffix: string } | null {
  const cleaned = val.replace(/,/g, '');
  const match = cleaned.match(/^(-?[\d.]+)\s*([KkMmBb]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  return { num, unitSuffix: match[2].toUpperCase() };
}

function formatNumber(num: number, decimals: number): string {
  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

function dampedBounce(t: number, amplitude = 4, frequency = 3.5, decay = 5): number {
  if (t <= 0) return 0;
  return amplitude * Math.exp(-decay * t) * Math.abs(Math.sin(frequency * Math.PI * t));
}

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u;
function parseLabel(text: string): { icon: string | null; label: string } {
  const m = text.match(EMOJI_RE);
  if (m) return { icon: m[0].trim(), label: text.slice(m[0].length) };
  return { icon: null, label: text };
}

const RingGauge: React.FC<{
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  bgColor: string;
}> = ({ size, strokeWidth, progress, color, bgColor }) => {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={bgColor} strokeWidth={strokeWidth} opacity={0.12}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" opacity={0.7}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 10px ${color}80)` }}
      />
    </svg>
  );
};

export const StatsCard: React.FC<StatsCardProps> = ({
  stats,
  cardTitle,
  frame = 'none',
}) => {
  const theme = useTheme();
  const isSlidesMode = useIsSlidesMode();
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { width } = useVideoConfig();
  const count = stats.length;
  const columns = count <= 3 ? count : 2;
  const numberColor = frame === 'none' ? theme.colors.onLight : theme.colors.onCard;
  const labelColor = frame === 'none' ? theme.colors.secondary : theme.colors.onCardMuted;
  const ringBgColor = frame === 'none' ? theme.colors.border : theme.colors.secondary;

  // Adaptive sizing — shrink for narrow layouts (Shorts = 1080px)
  const isNarrow = width <= 1080;
  const ringSize = isNarrow
    ? (count <= 2 ? 320 : 260)
    : (count <= 2 ? 400 : 340);
  const strokeWidth = isNarrow
    ? (count <= 2 ? 24 : 20)
    : (count <= 2 ? 28 : 24);
  const numFontSize = isNarrow
    ? (count <= 2 ? 108 : 84)
    : (count <= 2 ? 136 : 108);
  const labelSize = isNarrow
    ? (count <= 2 ? 34 : 30)
    : (count <= 2 ? 38 : 34);

  // Unified font size: compute per-stat shrink, then use the smallest across all stats
  const innerDiameter = ringSize - strokeWidth * 2 - 16;
  const unifiedFontSize = Math.min(...stats.map((stat) => {
    const fullText = `${stat.prefix || ''}${stat.value}${stat.suffix || ''}`;
    const charWidth = /[\u4e00-\u9fff]/.test(fullText) ? 1.1 : 0.6;
    const estimatedWidth = fullText.length * charWidth * numFontSize;
    return estimatedWidth > innerDiameter
      ? Math.floor(numFontSize * (innerDiameter / estimatedWidth))
      : numFontSize;
  }));

  return (
    <BaseCard
      frame={frame}
      frameTitle={cardTitle || 'Key Metrics'}
      frameTag="DATA"
      frameTagColor="green"
      padding="none"
    >
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: count <= 2 ? 60 : 40,
        alignContent: 'center',
        justifyItems: 'center',
        padding: '20px 24px',
        height: '100%',
        boxSizing: 'border-box',
      }}>
        {stats.map((stat, index) => {
          const stagger = Math.floor(index * fps * 0.4);

          const progress = isSlidesMode ? 1 : spring({
            frame: Math.max(0, currentFrame - stagger),
            fps,
            config: { damping: 14, stiffness: 60, mass: 1.2, overshootClamping: false },
          });

          const parsed = parseNumericValue(stat.value);
          const isNumeric = parsed !== null;
          const decimalPlaces = stat.value.includes('.')
            ? (stat.value.split('.')[1]?.replace(/,/g, '').length || 0) : 0;

          const displayValue = (() => {
            if (!isNumeric || isSlidesMode) return stat.value;
            const animated = parsed.num * progress;
            return formatNumber(animated, decimalPlaces) + parsed.unitSuffix;
          })();

          const ringProgress = isSlidesMode ? 1 : interpolate(
            Math.max(0, currentFrame - stagger),
            [0, Math.floor(fps * 2.0)],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
          );

          const bounceStartFrame = stagger + Math.floor(fps * 1.0);
          const timeSinceLanding = (currentFrame - bounceStartFrame) / fps;
          const bounceY = (!isSlidesMode && timeSinceLanding > 0)
            ? -dampedBounce(timeSinceLanding, 5, 3.0 + index * 0.4, 4.5) : 0;

          const glowIntensity = (!isSlidesMode && timeSinceLanding > 0)
            ? 10 * Math.exp(-2 * timeSinceLanding) : 0;

          const entryOpacity = interpolate(progress, [0, 0.3], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const entryScale = interpolate(progress, [0, 1], [0.6, 1]);

          const { icon, label } = parseLabel(stat.label);

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: entryOpacity,
                transform: `scale(${entryScale})`,
              }}
            >
              {/* Ring + number */}
              <div style={{
                position: 'relative',
                width: ringSize,
                height: ringSize,
                borderRadius: '50%',
                boxShadow: `0 0 24px ${theme.colors.primary}40, 0 0 60px ${theme.colors.primary}20`,
              }}>
                <RingGauge
                  size={ringSize}
                  strokeWidth={strokeWidth}
                  progress={ringProgress}
                  color={theme.colors.primary}
                  bgColor={ringBgColor}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: strokeWidth,
                }}>
                  <div style={{
                    fontSize: unifiedFontSize,
                    fontWeight: 800,
                    fontFamily: theme.fonts.main,
                    color: numberColor,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    transform: `translateY(${bounceY}px)`,
                    whiteSpace: 'nowrap',
                    textShadow: glowIntensity > 0.5
                      ? `0 0 ${glowIntensity}px ${theme.colors.primary}, 0 0 ${glowIntensity * 2}px ${theme.colors.primary}40`
                      : 'none',
                  }}>
                    {stat.prefix && (
                      <span style={{ fontSize: '0.5em', opacity: 0.7, marginRight: 2, fontWeight: 600 }}>
                        {stat.prefix}
                      </span>
                    )}
                    {displayValue}
                    {stat.suffix && (
                      <span style={{ fontSize: '0.5em', opacity: 0.7, marginLeft: 2, fontWeight: 600 }}>
                        {stat.suffix}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Label below ring */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: icon ? 8 : 0,
                fontSize: labelSize,
                color: labelColor,
                fontFamily: theme.fonts.main,
                marginTop: 28,
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}>
                {icon && <span style={{ fontSize: '1.4em', lineHeight: 1 }}>{icon}</span>}
                <span>{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </BaseCard>
  );
};
