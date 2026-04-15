/**
 * @episode Demo Recording
 * @description 展示 registry-first 新卡片系統的精簡 Demo
 *
 * 此檔案刻意只保留已接上 CardSpec registry 的卡種，
 * 作為 agent / template / regression smoke test 的基線。
 */

import { Episode } from "../../engine/shared/types";

export const epDemo: Episode = {
  metadata: {
    title: 'Agentic Remotion Studio',
    subtitle: 'Registry-first card demo',
    skipAudio: true,
  },

  shell: {
    layout: 'streaming',
    scene: 'webinar',
    config: {
      vtuber: {
        enabled: true,
        closedImg: 'episodes/template/shared/vtuber/ginseng_closed.png',
        openImg: 'episodes/template/shared/vtuber/ginseng_open.png',
        volumeThreshold: 0.02,
        width: 462,
        height: 462,
      },
      subtitle: {
        enabled: true,
        style: 'bottom-center',
        fontSize: 34,
        background: 'rgba(0, 0, 0, 0.8)',
      },
    },
  },

  steps: [
    {
      id: 'intro',
      contentType: 'cover',
      layoutMode: 'fullscreen',
      backgroundPreset: 'aurora',
      animation: 'matrix',
      narration: '歡迎來到 Agentic Remotion Studio。這個 demo 只展示已正式接上新卡片系統的主路徑。',
      durationInSeconds: 5,
    },
    {
      id: 'demo_markdown',
      contentType: 'markdown',
      layoutMode: 'title-card',
      backgroundPreset: 'default',
      effect: 'fadeIn',
      phase: 'Part 1: Narrative Cards',
      title: 'Markdown Card',
      description: 'Registry-first renderer now drives the template path',
      cardTitle: 'Why registry-first matters',
      cardTag: 'MARKDOWN',
      tagColor: 'blue',
      cardContent: `## New card contract

- 每張卡都由 \`CardSpec\` 註冊
- component 明確吃 \`CardRenderProps<TData>\`
- template 只展示已正式支援的卡種`,
      narration: '先看 markdown card。現在 template 只展示已經正式接上 registry 的卡種。',
      durationInSeconds: 6,
    },
    {
      id: 'demo_code',
      contentType: 'code',
      layoutMode: 'card-only',
      backgroundPreset: 'minimal',
      effect: 'slideUp',
      windowTitle: 'summary/spec.ts',
      code: `import type { CardSpec } from "../types";

export const cardSpec = {
  type: "summary",
  title: "Summary",
  schemaVersion: 1,
  component: SummaryCardComponent,
} satisfies CardSpec<SummaryCardData>;`,
      language: 'typescript',
      narration: 'Code card 也走同一套 spec contract，不再是各卡自己長自己的介面。',
      durationInSeconds: 6,
    },
    {
      id: 'demo_image',
      contentType: 'image',
      layoutMode: 'fullscreen',
      backgroundPreset: 'default',
      effect: 'scaleIn',
      imageTitle: 'Ginseng YouTube Cover',
      imageSrc: 'episodes/template/shared/reference/ginseng-yt-ep024.jpg',
      imageCaption: 'Upstream ginseng-channel YouTube thumbnail reference',
      narration: '這張 image card 現在改用上游 ginseng-channel 的 YouTube 縮圖，方便拿來當 demo 參考。',
      durationInSeconds: 5,
    },
    {
      id: 'demo_mermaid',
      contentType: 'mermaid',
      layoutMode: 'card-only',
      backgroundPreset: 'default',
      effect: 'fadeIn',
      mermaidTitle: 'Renderer Path',
      mermaidChart: `graph TB
    A[Episode Step] --> B[WebinarScene]
    B --> C[getCard type]
    C --> D[CardSpec component]
    D --> E[BaseSlide primitives]`,
      narration: 'Mermaid card 用來展示新的 registry-first renderer path。',
      durationInSeconds: 6,
    },
    {
      id: 'demo_custom_chart',
      contentType: 'template/quarterly-performance',
      layoutMode: 'fullscreen',
      narration: '這張是 episode-local custom card。它不進 core engine，但一樣符合 BaseSlide 與 CardSpec contract。',
      durationInSeconds: 8,
      data: {
        title: '季度業績',
        subtitle: '各季銷售表現概覽',
        maxValue: 100,
        items: [
          { label: 'Q1', value: 68, tone: 'info' },
          { label: 'Q2', value: 85, tone: 'highlight' },
          { label: 'Q3', value: 72, tone: 'accent' },
          { label: 'Q4', value: 95, tone: 'positive' },
          { label: 'Q5', value: 58, tone: 'warning' },
          { label: 'Q6', value: 88, tone: 'primary' },
        ],
      },
    },
    {
      id: 'demo_ticker',
      contentType: 'ticker',
      layoutMode: 'card-only',
      backgroundPreset: 'spotlight',
      cardTitle: 'Ticker',
      cardContent: `One Schema
One Registry
One Renderer`,
      narration: 'Ticker card 現在也有新的 base-driven 實作。',
      durationInSeconds: 8,
    },
    {
      id: 'demo_ticker_kinetic',
      contentType: 'ticker',
      layoutMode: 'card-only',
      backgroundPreset: 'spotlight',
      tickerStyle: 'kinetic',
      cardTitle: 'Kinetic',
      cardContent: `Summary
Ticker
Mermaid`,
      narration: '這張展示 kinetic 模式，確認新的 ticker spec 也能工作。',
      durationInSeconds: 8,
    },
    {
      id: 'ending',
      contentType: 'summary',
      layoutMode: 'fullscreen',
      backgroundPreset: 'aurora',
      effect: 'fadeIn',
      summaryTitle: 'Registry-first baseline',
      summaryPoints: [
        'template 只保留正式支援的卡種',
        'summary / ticker / mermaid 已遷到 CardSpec',
        'ep-demo 現在多了一張 template scoped custom chart card',
        'renderer 先走 registry，再 fallback 給少數舊卡',
        'demo 不再展示 compare / stats / timeline / flowchart',
      ],
      summaryCtaButtons: [
        { label: 'Ship episodes', icon: '🚀' },
        { label: 'Keep cards narrow', icon: '🧩' },
      ],
      summaryShowCta: true,
      narration: '這個 demo 現在專注於新的卡片主路徑，而不是把所有舊卡全部堆在一起。',
      durationInSeconds: 7,
    },
  ],
};
