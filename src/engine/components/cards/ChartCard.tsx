/**
 * @component ChartCard
 * @description Minimal data chart card for bar / line / pie visuals.
 *
 * @agent-note
 * - Designed for storytelling charts, not dashboard density.
 * - Best with 3-6 data points.
 * - Uses single-series data with optional per-point color overrides.
 */

import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useTheme } from "../../shared/ThemeContext";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

export type ChartCardProps = {
  type: "bar" | "line" | "pie";
  data: ChartDatum[];
  cardTitle?: string;
  frame?: WindowFrameType;
  embedded?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  yMax?: number;
  highlightIndex?: number;
  showLegend?: boolean;
  sourceLabel?: string;
};

const CHART_W = 1100;
const CHART_H = 580;
const MARGIN = { top: 24, right: 48, bottom: 112, left: 88 };

function formatValue(value: number, prefix = "", suffix = ""): string {
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${prefix}${display}${suffix}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  type,
  data,
  cardTitle,
  frame = "none",
  embedded = false,
  valuePrefix,
  valueSuffix,
  yMax,
  highlightIndex,
  showLegend = true,
  sourceLabel,
}) => {
  const theme = useTheme();
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isSlidesMode = useIsSlidesMode();
  const containerPadding = embedded ? "8px 14px 0" : "16px 28px 0";
  const sourceLabelTop = embedded ? 0 : 10;
  const sourceLabelRight = embedded ? 14 : 28;
  const legendMarginTop = embedded ? 2 : 6;

  const safeData = data.filter((item) => Number.isFinite(item.value));
  const rawMaxValue = Math.max(...safeData.map((item) => item.value), 0);
  const paddedYMax = rawMaxValue > 0 ? Math.ceil(rawMaxValue * 1.12) : 1;
  const maxValue = Math.max(1, yMax ?? paddedYMax);
  const gridValues = useMemo(() => (
    [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio))
  ), [maxValue]);

  const plotW = CHART_W - MARGIN.left - MARGIN.right;
  const plotH = CHART_H - MARGIN.top - MARGIN.bottom;
  const baselineY = MARGIN.top + plotH;
  const leftX = MARGIN.left;

  const palette = [
    theme.colors.primary,
    theme.colors.accent,
    theme.colors.secondary,
    "#72c3dc",
    "#d4b896",
    "#8fcf95",
  ];

  const colorForIndex = (index: number, fallback?: string) =>
    fallback || palette[index % palette.length];

  const renderBar = () => {
    const barSlot = plotW / Math.max(1, safeData.length);
    const barWidth = Math.min(90, barSlot * 0.55);

    return (
      <>
        {gridValues.map((value) => {
          const y = baselineY - (value / maxValue) * plotH;
          return (
            <g key={`grid-${value}`}>
              <line
                x1={leftX}
                y1={y}
                x2={leftX + plotW}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth={1}
                opacity={0.35}
              />
              <text
                x={leftX - 26}
                y={y + 6}
                textAnchor="end"
                fontSize={20}
                fill={theme.colors.secondary}
                fontFamily={theme.fonts.main}
              >
                {formatValue(value, valuePrefix, valueSuffix)}
              </text>
            </g>
          );
        })}

        {safeData.map((item, index) => {
          const progress = isSlidesMode ? 1 : spring({
            frame: Math.max(0, currentFrame - index * Math.floor(fps * 0.12)),
            fps,
            config: { damping: 18, stiffness: 90, mass: 1 },
          });
          const h = (item.value / maxValue) * plotH * progress;
          const x = leftX + barSlot * index + (barSlot - barWidth) / 2;
          const y = baselineY - h;
          const fill = colorForIndex(index, item.color);
          const active = highlightIndex === index;
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(0, h)}
                rx={16}
                fill={fill}
                opacity={active ? 1 : 0.82}
                style={{ filter: active ? `drop-shadow(0 0 18px ${fill}88)` : undefined }}
              />
              <text
                x={x + barWidth / 2}
                y={y - 14}
                textAnchor="middle"
                fontSize={24}
                fontWeight={700}
                fill={theme.colors.onCard}
                fontFamily={theme.fonts.main}
              >
                {formatValue(item.value, valuePrefix, valueSuffix)}
              </text>
              <text
                x={x + barWidth / 2}
                y={baselineY + 24}
                textAnchor="middle"
                fontSize={20}
                fill={theme.colors.secondary}
                fontFamily={theme.fonts.main}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </>
    );
  };

  const renderLine = () => {
    const slot = safeData.length > 1 ? plotW / (safeData.length - 1) : 0;
    const points = safeData.map((item, index) => ({
      x: leftX + slot * index,
      y: baselineY - (item.value / maxValue) * plotH,
      item,
      index,
    }));
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const pathProgress = isSlidesMode ? 1 : spring({
      frame: currentFrame,
      fps,
      config: { damping: 20, stiffness: 80, mass: 1.2 },
    });

    return (
      <>
        {gridValues.map((value) => {
          const y = baselineY - (value / maxValue) * plotH;
          return (
            <g key={`grid-${value}`}>
              <line
                x1={leftX}
                y1={y}
                x2={leftX + plotW}
                y2={y}
                stroke={theme.colors.border}
                strokeWidth={1}
                opacity={0.35}
              />
              <text
                x={leftX - 26}
                y={y + 6}
                textAnchor="end"
                fontSize={20}
                fill={theme.colors.secondary}
                fontFamily={theme.fonts.main}
              >
                {formatValue(value, valuePrefix, valueSuffix)}
              </text>
            </g>
          );
        })}
        <path
          d={path}
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - pathProgress}
          style={{ filter: `drop-shadow(0 0 14px ${theme.colors.primary}66)` }}
        />
        {points.map((point, index) => {
          const progress = isSlidesMode ? 1 : interpolate(
            currentFrame,
            [index * Math.floor(fps * 0.18), index * Math.floor(fps * 0.18) + Math.floor(fps * 0.35)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const active = highlightIndex === index;
          return (
            <g key={point.item.label} opacity={progress}>
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? 12 : 9}
                fill={colorForIndex(index, point.item.color)}
                style={{ filter: active ? `drop-shadow(0 0 14px ${colorForIndex(index, point.item.color)}99)` : undefined }}
              />
              <text
                x={point.x}
                y={point.y - 18}
                textAnchor="middle"
                fontSize={22}
                fontWeight={700}
                fill={theme.colors.onCard}
                fontFamily={theme.fonts.main}
              >
                {formatValue(point.item.value, valuePrefix, valueSuffix)}
              </text>
              <text
                x={point.x}
                y={baselineY + 24}
                textAnchor="middle"
                fontSize={20}
                fill={theme.colors.secondary}
                fontFamily={theme.fonts.main}
              >
                {point.item.label}
              </text>
            </g>
          );
        })}
      </>
    );
  };

  const renderPie = () => {
    const total = Math.max(1, safeData.reduce((sum, item) => sum + item.value, 0));
    const cx = CHART_W * 0.36;
    const cy = CHART_H * 0.46;
    const radius = 170;
    const progress = isSlidesMode ? 1 : spring({
      frame: currentFrame,
      fps,
      config: { damping: 16, stiffness: 80, mass: 1.1 },
    });
    let cursor = 0;

    return (
      <>
        {safeData.map((item, index) => {
          const slice = (item.value / total) * 360 * progress;
          const start = cursor;
          const end = cursor + slice;
          cursor += (item.value / total) * 360;
          const color = colorForIndex(index, item.color);
          return (
            <path
              key={item.label}
              d={describeArc(cx, cy, radius, start, end)}
              fill="none"
              stroke={color}
              strokeWidth={56}
              strokeLinecap="round"
              opacity={highlightIndex === index ? 1 : 0.88}
              style={{ filter: highlightIndex === index ? `drop-shadow(0 0 14px ${color}88)` : undefined }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={92} fill={theme.colors.surfaceCard} opacity={0.95} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={30} fontWeight={700} fill={theme.colors.onCard} fontFamily={theme.fonts.main}>
          Total
        </text>
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize={40} fontWeight={800} fill={theme.colors.primary} fontFamily={theme.fonts.main}>
          {formatValue(total, valuePrefix, valueSuffix)}
        </text>
      </>
    );
  };

  const chartInner = (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: containerPadding,
        gap: 0,
        position: "relative",
      }}
    >
      {sourceLabel && (
        <div
          style={{
            position: "absolute",
            top: sourceLabelTop,
            right: sourceLabelRight,
            color: theme.colors.onCardMuted,
            fontFamily: theme.fonts.main,
            fontSize: 15,
            opacity: 0.9,
            zIndex: 1,
          }}
        >
          {sourceLabel}
        </div>
      )}

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ width: "100%", flex: 1, minHeight: 0 }}
      >
        {type !== "pie" && (
          <line
            x1={leftX}
            y1={baselineY}
            x2={leftX + plotW}
            y2={baselineY}
            stroke={theme.colors.border}
            strokeWidth={2}
            opacity={0.7}
          />
        )}
        {type === "bar" && renderBar()}
        {type === "line" && renderLine()}
        {type === "pie" && renderPie()}
      </svg>

      {showLegend && safeData.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            justifyContent: "center",
            color: theme.colors.secondary,
            fontFamily: theme.fonts.main,
            fontSize: 18,
            marginTop: legendMarginTop,
          }}
        >
          {safeData.map((item, index) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: colorForIndex(index, item.color),
                  display: "inline-block",
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return chartInner;
  }

  return (
    <BaseCard
      frame={frame}
      frameTitle={cardTitle || "Chart"}
      frameTag="CHART"
      frameTagColor="green"
      padding="none"
    >
      {chartInner}
    </BaseCard>
  );
};
