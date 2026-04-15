import React from "react";
import { ChartCard } from "../ChartCard";
import type { ChartDatum } from "../ChartCard";
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
          overflow: "visible",
          position: "relative",
        }}
      >
        <ChartCard
          type={chartType}
          data={chartData}
          embedded
          valuePrefix={valuePrefix}
          valueSuffix={valueSuffix}
          showLegend={chartData.length <= 5}
          sourceLabel={sourceLabel}
        />
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
