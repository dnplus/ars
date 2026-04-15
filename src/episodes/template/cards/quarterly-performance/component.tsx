import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BaseSlide } from "../../../../engine/primitives/BaseSlide";
import { useTheme } from "../../../../engine/shared/ThemeContext";
import type { Theme } from "../../../../engine/shared/theme";
import type { CardRenderProps } from "../../../../engine/cards/types";
import type { QuarterlyPerformanceDatum } from "./spec";

export type QuarterlyPerformanceData = {
  title: string;
  subtitle?: string;
  maxValue?: number;
  items: QuarterlyPerformanceDatum[];
};

const CHART_WIDTH = 1100;
const CHART_HEIGHT = 560;
const BAR_GAP = 40;
const GRID_LINES = [0, 25, 50, 75, 100];

const resolveBarColor = (
  theme: Theme,
  tone: keyof Theme["colors"],
) => theme.colors[tone] ?? theme.colors.primary;

export const QuarterlyPerformanceComponent: React.FC<
  CardRenderProps<QuarterlyPerformanceData>
> = ({ data }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = data.items;
  const maxValue = Math.max(1, data.maxValue ?? 100);
  const barWidth =
    items.length > 0
      ? (CHART_WIDTH - BAR_GAP * (items.length + 1)) / items.length
      : CHART_WIDTH;

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 70 },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-30, 0]);

  return (
    <BaseSlide
      background={{ kind: "theme", token: "surfaceDark" }}
      padding="none"
      align={{ justifyContent: "center", alignItems: "center" }}
    >
      <AbsoluteFill
        style={{
          fontFamily: theme.fonts.main,
          background: theme.colors.surfaceDark,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 80,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: theme.colors.onDark,
              letterSpacing: "0.04em",
            }}
          >
            {data.title}
          </div>
          {data.subtitle ? (
            <div
              style={{
                marginTop: 10,
                fontSize: 22,
                color: theme.colors.onCardMuted,
                letterSpacing: "0.06em",
              }}
            >
              {data.subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: (1920 - CHART_WIDTH) / 2,
            width: CHART_WIDTH,
            height: CHART_HEIGHT,
          }}
        >
          {GRID_LINES.map((gridVal) => {
            const yPos = CHART_HEIGHT - (gridVal / 100) * CHART_HEIGHT;
            const gridProgress = spring({
              frame,
              fps,
              config: { damping: 40, stiffness: 60 },
            });
            const gridOpacity = interpolate(gridProgress, [0, 1], [0, 1]);

            return (
              <div key={gridVal}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: yPos,
                    height: 1,
                    background:
                      gridVal === 0
                        ? theme.colors.border
                        : theme.colors.borderLight,
                    opacity: gridOpacity,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: -52,
                    top: yPos - 12,
                    fontSize: 20,
                    color: theme.colors.textMuted,
                    opacity: gridOpacity,
                    textAlign: "right",
                    width: 44,
                  }}
                >
                  {Math.round((gridVal / 100) * maxValue)}
                </div>
              </div>
            );
          })}

          {items.map((item, index) => {
            const startFrame = index * 12;
            const barProgress = spring({
              frame: Math.max(0, frame - startFrame),
              fps,
              config: { damping: 22, stiffness: 90 },
            });

            const barHeight = interpolate(
              barProgress,
              [0, 1],
              [0, (item.value / maxValue) * CHART_HEIGHT],
            );
            const labelOpacity = interpolate(barProgress, [0.3, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const displayValue = Math.round(
              interpolate(barProgress, [0, 1], [0, item.value], {
                extrapolateRight: "clamp",
              }),
            );
            const x = BAR_GAP + index * (barWidth + BAR_GAP);
            const barColor = resolveBarColor(theme, item.tone);

            return (
              <div key={item.label}>
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    bottom: 0,
                    width: barWidth,
                    height: barHeight,
                    background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}cc 100%)`,
                    borderRadius: "6px 6px 0 0",
                    boxShadow: `0 0 24px ${theme.colors.shadowDark}`,
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: x,
                    bottom: barHeight + 10,
                    width: barWidth,
                    textAlign: "center",
                    fontSize: 26,
                    fontWeight: 700,
                    color: barColor,
                    opacity: labelOpacity,
                  }}
                >
                  {displayValue}
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: x,
                    bottom: -38,
                    width: barWidth,
                    textAlign: "center",
                    fontSize: 24,
                    color: theme.colors.textMuted,
                    opacity: labelOpacity,
                  }}
                >
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </BaseSlide>
  );
};
