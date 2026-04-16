import type { CardSpec } from "../../../../engine/cards/types";
import {
  NormalDistributionComponent,
  type NormalDistributionData,
} from "./component";

export const cardSpec = {
  type: "template/normal-distribution",
  title: "Normal Distribution",
  description: "Animated bell-curve chart for showing a mean-centered distribution.",
  defaults: {
    title: "常態分配圖",
    subtitle: "平均值附近最集中，越往兩端機率越低",
    mean: 100,
    standardDeviation: 15,
    min: 55,
    max: 145,
    xLabel: "分數 / 表現區間",
    centerLabel: "平均值",
  } satisfies Partial<NormalDistributionData>,
  component: NormalDistributionComponent,
  agentHints: {
    whenToUse:
      "Use for distributions, exam score spreads, or any mean-centered range explanation.",
    notForUseCases:
      "Not for category comparisons, stacked compositions, or dense statistical dashboards.",
    exampleData: {
      title: "考試分數分佈",
      subtitle: "平均值附近最集中，越往兩端人數越少",
      mean: 72,
      standardDeviation: 10,
      min: 40,
      max: 100,
      xLabel: "分數",
      centerLabel: "班級平均",
      bands: [
        { label: "偏低", start: 40, end: 62, tone: "rgba(59,130,246,0.18)" },
        { label: "主要群體", start: 62, end: 82, tone: "rgba(245,158,11,0.22)" },
        { label: "偏高", start: 82, end: 100, tone: "rgba(16,185,129,0.18)" },
      ],
    },
  },
} satisfies CardSpec<NormalDistributionData>;
