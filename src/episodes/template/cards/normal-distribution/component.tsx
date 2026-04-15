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
import type { CardRenderProps } from "../../../../engine/cards/types";

export type NormalDistributionBand = {
  label: string;
  start: number;
  end: number;
  tone: string;
};

export type NormalDistributionData = {
  title: string;
  subtitle?: string;
  mean: number;
  standardDeviation: number;
  min: number;
  max: number;
  xLabel?: string;
  centerLabel?: string;
  curveColor?: string;
  bands: NormalDistributionBand[];
};

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const CHART_WIDTH = 1160;
const CHART_HEIGHT = 520;
const AXIS_LEFT = (CANVAS_WIDTH - CHART_WIDTH) / 2;
const AXIS_TOP = 270;
const AXIS_BOTTOM = AXIS_TOP + CHART_HEIGHT;
const CURVE_SAMPLES = 120;

const gaussian = (x: number, mean: number, sigma: number) => {
  const coefficient = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const exponent = -((x - mean) ** 2) / (2 * sigma * sigma);
  return coefficient * Math.exp(exponent);
};

const toChartX = (value: number, min: number, max: number) =>
  AXIS_LEFT + ((value - min) / (max - min)) * CHART_WIDTH;

export const NormalDistributionComponent: React.FC<
  CardRenderProps<NormalDistributionData>
> = ({ data }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 90 },
  });
  const curveProgress = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const markerProgress = spring({
    frame: Math.max(0, frame - 22),
    fps,
    config: { damping: 20, stiffness: 90 },
  });

  const halfRange = Math.max(
    data.mean - data.min,
    data.max - data.mean,
    data.standardDeviation * 2.5,
  );
  const domainMin = data.mean - halfRange;
  const domainMax = data.mean + halfRange;

  const peak = gaussian(data.mean, data.mean, data.standardDeviation);
  const samples = Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => {
    const t = index / CURVE_SAMPLES;
    const value = domainMin + (domainMax - domainMin) * t;
    const density = gaussian(value, data.mean, data.standardDeviation);
    const normalized = density / peak;
    return {
      value,
      density,
      x: toChartX(value, domainMin, domainMax),
      y: AXIS_BOTTOM - normalized * CHART_HEIGHT,
    };
  });

  const path = samples
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-24, 0]);
  const curveRevealWidth = interpolate(curveProgress, [0, 1], [0, CHART_WIDTH + 120], {
    extrapolateRight: "clamp",
  });
  const markerOpacity = interpolate(markerProgress, [0.2, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const meanX = toChartX(data.mean, domainMin, domainMax);
  const tickValues = [
    domainMin,
    data.mean - data.standardDeviation,
    data.mean,
    data.mean + data.standardDeviation,
    domainMax,
  ];

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
          color: theme.colors.onDark,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 84,
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
                letterSpacing: "0.04em",
              }}
            >
              {data.subtitle}
            </div>
          ) : null}
        </div>

        <svg
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <line
            x1={AXIS_LEFT}
            y1={AXIS_BOTTOM}
            x2={AXIS_LEFT + CHART_WIDTH}
            y2={AXIS_BOTTOM}
            stroke={theme.colors.border}
            strokeWidth={2}
            opacity={0.9}
          />

          {data.bands.map((band, index) => {
            const rangeStart = index === 0 ? domainMin : band.start;
            const rangeEnd = index === data.bands.length - 1 ? domainMax : band.end;
            const startX = toChartX(rangeStart, domainMin, domainMax);
            const endX = toChartX(rangeEnd, domainMin, domainMax);
            const bandOpacity = interpolate(markerProgress, [0.1 + index * 0.06, 0.5 + index * 0.06], [0, 0.82], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <g key={band.label} opacity={bandOpacity}>
                <rect
                  x={startX}
                  y={AXIS_TOP}
                  width={Math.max(0, endX - startX)}
                  height={CHART_HEIGHT}
                  fill={band.tone}
                  rx={16}
                />
                <text
                  x={(startX + endX) / 2}
                  y={AXIS_BOTTOM + 48}
                  fill={theme.colors.onCardMuted}
                  fontSize={22}
                  textAnchor="middle"
                >
                  {band.label}
                </text>
              </g>
            );
          })}

          <defs>
            <clipPath id="normal-curve-reveal">
              <rect
                x={AXIS_LEFT - 20}
                y={AXIS_TOP - 40}
                width={curveRevealWidth}
                height={CHART_HEIGHT + 80}
              />
            </clipPath>
          </defs>

          <path
            d={path}
            fill="none"
            stroke={data.curveColor ?? theme.colors.highlight}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#normal-curve-reveal)"
          />

          <line
            x1={meanX}
            y1={AXIS_TOP}
            x2={meanX}
            y2={AXIS_BOTTOM}
            stroke={theme.colors.primary}
            strokeDasharray="12 10"
            strokeWidth={3}
            opacity={markerOpacity}
          />

          <text
            x={meanX}
            y={AXIS_TOP - 24}
            fill={theme.colors.primary}
            fontSize={24}
            fontWeight={700}
            textAnchor="middle"
            opacity={markerOpacity}
          >
            {data.centerLabel ?? "平均值"}
          </text>

          {tickValues.map((value) => (
            <g key={value} opacity={markerOpacity}>
              <line
                x1={toChartX(value, domainMin, domainMax)}
                y1={AXIS_BOTTOM}
                x2={toChartX(value, domainMin, domainMax)}
                y2={AXIS_BOTTOM + 14}
                stroke={theme.colors.border}
                strokeWidth={2}
              />
              <text
                x={toChartX(value, domainMin, domainMax)}
                y={AXIS_BOTTOM + 86}
                fill={theme.colors.textMuted}
                fontSize={22}
                textAnchor="middle"
              >
                {Math.round(value)}
              </text>
            </g>
          ))}

          {data.xLabel ? (
            <text
              x={AXIS_LEFT + CHART_WIDTH / 2}
              y={AXIS_BOTTOM + 134}
              fill={theme.colors.onCardMuted}
              fontSize={24}
              textAnchor="middle"
              opacity={markerOpacity}
            >
              {data.xLabel}
            </text>
          ) : null}
        </svg>
      </AbsoluteFill>
    </BaseSlide>
  );
};
