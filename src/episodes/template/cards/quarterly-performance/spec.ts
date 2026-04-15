import type { Theme } from "../../../../engine/shared/theme";
import type { CardSpec } from "../../../../engine/cards/types";
import {
  QuarterlyPerformanceComponent,
  type QuarterlyPerformanceData,
} from "./component";

export type QuarterlyPerformanceDatum = {
  label: string;
  value: number;
  tone: keyof Theme["colors"];
};

export const cardSpec = {
  type: "template/quarterly-performance",
  title: "Quarterly Performance",
  description: "Animated bar-chart card for quarter-by-quarter KPI snapshots.",
  schemaVersion: 1,
  defaults: {
    title: "季度業績",
    subtitle: "各季銷售表現概覽",
    maxValue: 100,
  } satisfies Partial<QuarterlyPerformanceData>,
  component: QuarterlyPerformanceComponent,
  agentHints: {
    whenToUse:
      "Use for compact KPI comparisons where each category should animate in as a single bar.",
    notForUseCases:
      "Not for dense financial tables or charts that need multiple axes and legends.",
    exampleData: {
      title: "季度業績",
      subtitle: "各季銷售表現概覽",
      maxValue: 100,
      items: [
        { label: "Q1", value: 68, tone: "info" },
        { label: "Q2", value: 85, tone: "highlight" },
        { label: "Q3", value: 72, tone: "accent" },
      ],
    },
  },
  status: "active",
} satisfies CardSpec<QuarterlyPerformanceData>;
