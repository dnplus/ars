import React from "react";
import type { ChartDatum } from "./types";
import type { StatItem } from "../StatsCard";
import { useTheme } from "../../../shared/ThemeContext";

const metricAccent = ["#7dd3fc", "#fca5a5", "#86efac", "#fcd34d"];

export const DashboardView: React.FC<{
  stats?: StatItem[];
  chartType?: "bar" | "line" | "pie";
  chartData?: ChartDatum[];
  valuePrefix?: string;
  valueSuffix?: string;
  sourceLabel?: string;
  insight?: string;
}> = ({
  stats = [],
  chartType = "bar",
  chartData = [],
  valuePrefix,
  valueSuffix,
  sourceLabel,
  insight,
}) => {
  const theme = useTheme();

  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        gridTemplateRows: stats.length > 0 ? "auto 1fr" : "1fr",
        gap: 12,
        padding: 14,
        background:
          `radial-gradient(circle at top left, ${theme.colors.primary}18, transparent 34%), ${theme.colors.surfaceCardHeader}`,
      }}
    >
      {stats.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))`,
            gap: 14,
          }}
        >
          {stats.slice(0, 4).map((stat, index) => (
            <div
              key={`${stat.label}-${index}`}
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: theme.colors.surfaceCard,
                boxShadow: `inset 0 0 0 1px ${metricAccent[index % metricAccent.length]}20, 0 8px 20px ${theme.colors.shadow}`,
              }}
            >
              <div style={{ fontSize: 15, color: theme.colors.onCardMuted, marginBottom: 10 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: theme.colors.onCard }}>
                {stat.prefix}
                {stat.value}
                {stat.suffix}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "8px 14px",
        }}
      >
        {chartData.length > 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, minHeight: 0 }}>
            {chartData.map((d, i) => {
              const max = Math.max(...chartData.map(x => x.value), 1);
              const pct = (d.value / max) * 100;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 11, color: theme.colors.onCardMuted }}>{valuePrefix}{d.value}{valueSuffix}</div>
                  <div style={{ width: "100%", height: `${pct}%`, minHeight: 4, borderRadius: 4, background: d.color ?? theme.colors.primary, opacity: 0.85 }} />
                  <div style={{ fontSize: 11, color: theme.colors.onCardMuted, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{d.label}</div>
                </div>
              );
            })}
          </div>
        )}
        {sourceLabel && (
          <div style={{ fontSize: 11, color: theme.colors.onCardMuted, textAlign: "right" }}>{sourceLabel}</div>
        )}
        {insight && (
          <div
            style={{
              position: "absolute",
              left: 20,
              right: 20,
              bottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: `${theme.colors.surfaceCard}E8`,
              fontSize: 18,
              lineHeight: 1.5,
              color: theme.colors.onCard,
              boxShadow: `0 8px 24px ${theme.colors.shadow}`,
            }}
          >
            {insight}
          </div>
        )}
      </div>
    </div>
  );
};
