/**
 * @episode Demo Recording
 * @description ARS onboarding walkthrough episode
 */

import { Episode } from "../../engine/shared/types";

export const epDemo: Episode = {
  metadata: {
    title: "Agentic Remotion Studio",
    subtitle: "用 AI 做影片的工作流",
    skipAudio: true,
  },

  shell: {
    layout: "streaming",
    config: {
      vtuber: {
        enabled: true,
        closedImg: "episodes/template/shared/vtuber/ginseng_closed.png",
        openImg: "episodes/template/shared/vtuber/ginseng_open.png",
        volumeThreshold: 0.02,
        width: 462,
        height: 462,
      },
      subtitle: {
        enabled: true,
        style: "bottom-center",
        fontSize: 34,
        background: "rgba(0, 0, 0, 0.8)",
      },
    },
  },

  steps: [
    {
      id: "intro",
      contentType: "cover",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        animation: "matrix",
      },
      narration: "歡迎來到 Agentic Remotion Studio — 用 AI 做影片的工作流。",
      durationInSeconds: 5,
    },
    {
      id: "workflow",
      contentType: "mermaid",
      layoutMode: "card-only",
      background: "default",
      data: {
        title: "ARS Pipeline",
        chart: `graph LR
    A[plan] --> B[build]
    B --> C[review]
    C --> D[audio]
    D --> E[publish]`,
      },
      narration: "整個工作流分五個階段：規劃、實作、審稿、配音、發布。",
      durationInSeconds: 6,
    },
    {
      id: "episode-model",
      contentType: "markdown",
      layoutMode: "title-card",
      background: "default",
      data: {
        cardTitle: "Episode / Step 模型",
        cardTag: "CORE",
        tagColor: "blue",
        content: `## 每集是一個 TS 檔

- \`Episode\` 定義 metadata + shell + steps
- 每個 \`Step\` = 一個場景
- contentType 決定要渲染哪張卡`,
      },
      narration: "每集是一個 TypeScript 檔，steps 陣列裡每個物件就是一個場景。",
      durationInSeconds: 7,
    },
    {
      id: "card-types",
      contentType: "ticker",
      layoutMode: "card-only",
      background: "spotlight",
      data: {
        title: "Built-in Cards",
        content: `cover
markdown
code
mermaid
image
ticker
summary
normal-distribution`,
      },
      narration: "ARS 內建多種卡片類型，也支援 series-scoped custom cards。",
      durationInSeconds: 7,
    },
    {
      id: "claude-code-demo",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        title: "Claude Code × ARS",
        tag: "CLI",
        lines: [
          {
            type: "prompt",
            text: "/ars:plan 為什麼 TypeScript 是 2025 最受歡迎的語言",
          },
          { type: "info", text: "Planning episode: ts-popularity" },
          {
            type: "output",
            text: "Created: src/episodes/my-channel/ts-popularity/plan.md",
          },
          { type: "success", text: "Plan ready — 8 steps, estimated 4:30" },
          { type: "prompt", text: "/ars:build ts-popularity" },
          { type: "output", text: "Building steps... [████████░░] 6/8" },
          {
            type: "success",
            text: "Episode built — run /ars:review to preview",
          },
        ],
      },
      narration:
        "所有操作都在 Claude Code 裡完成。一個指令規劃，一個指令實作，然後用 Studio 審稿。",
      durationInSeconds: 8,
    },
    {
      id: "spec-example",
      contentType: "code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        title: "custom-card/spec.ts",
        code: `export const cardSpec = {
  type: "claude-code",
  title: "Claude Code",
  component: ClaudeCodeComponent,
  schema: ClaudeCodeSchema,
} satisfies CardSpec<ClaudeCodeData>;`,
        language: "typescript",
      },
      narration: "要加 custom card，只需要一個 spec.ts 和 component.tsx。",
      durationInSeconds: 6,
    },
    {
      id: "custom-card-demo",
      contentType: "normal-distribution",
      layoutMode: "fullscreen",
      narration:
        "這是 series-scoped custom card 的範例：常態分配圖。只要符合 CardSpec contract，任何自訂卡都能進 registry。",
      durationInSeconds: 7,
      data: {
        title: "Custom Card 範例",
        subtitle: "series-scoped card 直接進 registry",
        mean: 72,
        standardDeviation: 10,
        min: 40,
        max: 100,
        xLabel: "分數",
        centerLabel: "平均值",
        bands: [
          { label: "偏低", start: 40, end: 62, tone: "rgba(59,130,246,0.18)" },
          { label: "核心", start: 62, end: 82, tone: "rgba(245,158,11,0.22)" },
          { label: "偏高", start: 82, end: 100, tone: "rgba(16,185,129,0.18)" },
        ],
      },
    },
    {
      id: "onboard-guide",
      contentType: "markdown",
      layoutMode: "title-card",
      background: "default",
      data: {
        cardTitle: "Onboard 四階段",
        cardTag: "ONBOARD",
        tagColor: "purple",
        content: `1. **walkthrough** — 看 ep-demo，了解 ARS
2. **bootstrap** — 設定 series、TTS、YouTube
3. **customize** — 品牌客製化或從範本開始
4. **verify** — 跑 doctor，確認環境就緒`,
      },
      narration: "Onboard 分四個階段，帶你從零建立第一集。",
      durationInSeconds: 7,
    },
    {
      id: "ending",
      contentType: "summary",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        title: "準備好了嗎？",
        points: [
          "ARS = Episode TS + CardSpec + Remotion",
          "5 個工作流階段：plan → build → review → audio → publish",
          "Custom cards 只需 spec.ts + component.tsx",
          "跑 /ars:onboard 開始設定你的頻道",
        ],
        ctaButtons: [
          { label: "Run /ars:plan", icon: "🚀" },
          { label: "/ars:onboard", icon: "🎬" },
        ],
        showCta: true,
      },
      narration: "現在就跑 /ars:onboard 開始你的第一集。",
      durationInSeconds: 7,
    },
  ],
};
