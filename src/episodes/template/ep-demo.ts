/**
 * @episode Demo Recording
 * @description 展示所有卡片類型、佈局模式、進場特效、背景預設的完整 Demo
 *
 * 此檔案是 Agent 製作 demo / tutorial / step-by-step guide 的參考範本。
 * 涵蓋：
 * - 11 種 contentType：cover, text, code, image, mermaid, markdown, summary, ticker, compare, stats, timeline, flowchart
 * - 3 種 layoutMode：title-card, card-only, fullscreen
 * - 5 種 backgroundPreset：default, gradient-mesh, aurora, spotlight, minimal
 * - CardEffect 進場特效：fadeIn, slideUp, springIn, blurIn, scaleIn
 */

import { Episode } from "../../engine/shared/types";

export const epDemo: Episode = {
  metadata: {
    title: 'Agentic Remotion Studio',
    subtitle: '完整功能展示 — All Card Types & Effects',
    skipAudio: true,
  },

  shell: {
    layout: 'streaming',
    scene: 'webinar',
    config: {
      vtuber: {
        enabled: true,
        closedImg: 'episodes/template/shared/vtuber/luna.png',
        openImg: 'episodes/template/shared/vtuber/luna.png',
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
    // ============================================
    // 1. 開場 — CoverCard + Aurora 背景
    // ============================================
    {
      id: 'intro',
      contentType: 'cover',
      layoutMode: 'fullscreen',
      backgroundPreset: 'aurora',
      animation: 'matrix',
      narration: '歡迎來到 Agentic Remotion Studio 功能展示！這支影片將帶你認識所有卡片類型和視覺效果。',
      durationInSeconds: 5,
    },

    // ============================================
    // 2. InfoCard — title-card 模式（標準佈局）
    // ============================================
    {
      id: 'demo_text',
      contentType: 'text',
      layoutMode: 'title-card',
      backgroundPreset: 'default',
      effect: 'fadeIn',
      phase: 'Part 1: 基礎卡片',
      title: '文字卡片 (InfoCard)',
      description: 'title-card 模式：標題 + 卡片 + VTuber',
      cardTitle: '佈局模式總覽',
      cardTag: 'INFO',
      tagColor: 'blue',
      cardContent: '三種佈局模式：\n\n• title-card — 標準模式，上方顯示標題區\n• card-only — 卡片全高，無標題列\n• fullscreen — 滿版，VTuber 淡出\n\n每個 Step 都可以自由搭配不同的佈局模式。',
      narration: '首先是 InfoCard，搭配 title-card 模式。這是最基本也最常用的佈局。',
      durationInSeconds: 6,
    },

    // ============================================
    // 3. CodeCard — card-only + minimal 背景
    // ============================================
    {
      id: 'demo_code',
      contentType: 'code',
      layoutMode: 'card-only',
      backgroundPreset: 'minimal',
      effect: 'slideUp',
      windowTitle: 'episode-example.ts',
      code: `// 定義一個 Step — 程式即內容
const step: Step = {
  id: 'hello_world',
  contentType: 'code',
  layoutMode: 'card-only',
  backgroundPreset: 'minimal',
  effect: 'slideUp',
  code: 'console.log("Hello!")',
  language: 'typescript',
  narration: '你好世界！',
  durationInSeconds: 5,
};`,
      language: 'typescript',
      narration: '接下來是 CodeCard，使用 card-only 模式搭配 minimal 背景，讓程式碼更清晰。',
      durationInSeconds: 6,
    },

    // ============================================
    // 4. ImageCard — fullscreen（VTuber fadeout）
    // ============================================
    {
      id: 'demo_image',
      contentType: 'image',
      layoutMode: 'fullscreen',
      backgroundPreset: 'default',
      effect: 'scaleIn',
      imageTitle: '圖片卡片 (ImageCard)',
      imageSrc: 'episodes/template/shared/vtuber/luna.png',
      imageCaption: 'fullscreen 模式 — 圖片滿版，VTuber 優雅淡出',
      narration: '圖片卡片搭配 fullscreen 模式，內容佔滿整個畫面，注意 VTuber 會淡出。',
      durationInSeconds: 5,
    },

    // ============================================
    // 5. MarkdownCard — title-card（VTuber fadein）
    // ============================================
    {
      id: 'demo_markdown',
      contentType: 'markdown',
      layoutMode: 'title-card',
      backgroundPreset: 'default',
      effect: 'springIn',
      phase: 'Part 2: 進階卡片',
      title: 'Markdown 渲染',
      description: '支援標題、列表、粗體等 Markdown 語法',
      cardTitle: 'Markdown Card',
      cardTag: 'MD',
      tagColor: 'green',
      cardContent: `## 支援的語法

- **粗體文字**與 *斜體文字*
- 有序與無序列表
- \`行內程式碼\` 標記
- 多層級縮排

> 引用區塊也可以正常渲染`,
      narration: 'MarkdownCard 支援豐富的 Markdown 語法渲染，從 fullscreen 切回時 VTuber 會淡入。',
      durationInSeconds: 6,
    },

    // ============================================
    // 6. MermaidCard — card-only
    // ============================================
    {
      id: 'demo_mermaid',
      contentType: 'mermaid',
      layoutMode: 'card-only',
      backgroundPreset: 'default',
      effect: 'fadeIn',
      mermaidTitle: '卡片系統架構',
      mermaidChart: `graph TB
    A[WebinarScene] -->|contentType| B{Router}
    B --> C[CoverCard]
    B --> D[InfoCard]
    B --> E[CodeCard]
    B --> F[ImageCard]
    B --> G[MarkdownCard]
    B --> H[MermaidCard]
    B --> I[CompareCard]
    B --> J[StatsCard]
    B --> K[TimelineCard]
    B --> L[TickerCard]
    B --> M[SummaryCard]`,
      narration: 'MermaidCard 可以直接渲染流程圖。這張圖展示了我們的卡片路由系統。',
      durationInSeconds: 6,
    },

    // ============================================
    // 7. CompareCard — title-card
    // ============================================
    {
      id: 'demo_compare',
      contentType: 'compare',
      layoutMode: 'title-card',
      backgroundPreset: 'default',
      effect: 'slideUp',
      phase: 'Part 3: 特色卡片',
      title: '左右對比',
      description: 'CompareCard — 視覺化呈現差異',
      compareLeftTitle: '傳統方式 ❌',
      compareLeftItems: [
        '手動逐幀排版',
        '調整動畫時間軸',
        '設計工具切換',
        '匯出格式不統一',
      ],
      compareRightTitle: 'Agentic 方式 ✅',
      compareRightItems: [
        '程式碼定義內容',
        '自動動畫引擎',
        '統一 Step Schema',
        'Remotion 一鍵渲染',
      ],
      narration: 'CompareCard 可以將兩組資訊做左右對比，非常適合展示前後差異。',
      durationInSeconds: 7,
    },

    // ============================================
    // 8. StatsCard — card-only + gradient-mesh 背景
    // ============================================
    {
      id: 'demo_stats',
      contentType: 'stats',
      layoutMode: 'card-only',
      backgroundPreset: 'gradient-mesh',
      effect: 'scaleIn',
      stats: [
        { value: '11', label: '卡片類型', suffix: ' 種' },
        { value: '5', label: '背景預設', suffix: ' 款' },
        { value: '4', label: '進場特效', suffix: ' 型' },
        { value: '3', label: '佈局模式', suffix: ' 式' },
      ],
      narration: 'StatsCard 帶有彈跳動畫和霓虹光暈效果。搭配 gradient-mesh 背景，視覺衝擊力十足。',
      durationInSeconds: 7,
    },

    // ============================================
    // 9. TimelineCard — title-card
    // ============================================
    {
      id: 'demo_timeline',
      contentType: 'timeline',
      layoutMode: 'title-card',
      backgroundPreset: 'default',
      effect: 'slideUp',
      title: '開發歷程',
      description: 'TimelineCard — 時間軸式敘事',
      timelineItems: [
        { title: '基礎架構', description: 'Episode/Step Schema 設計', icon: '🏗️' },
        { title: '卡片系統', description: '11 種 ContentType 支援', icon: '🃏' },
        { title: '視覺升級', description: '動態背景 + 霓虹特效', icon: '✨' },
        { title: 'Agent 整合', description: '深度整合 Demo / Tutorial 生成', icon: '🤖' },
      ],
      narration: 'TimelineCard 用時間軸呈現順序事件，帶有動態進場效果。',
      durationInSeconds: 7,
    },

    // ============================================
    // 10. TickerCard — card-only + spotlight 背景
    // ============================================
    {
      id: 'demo_ticker',
      contentType: 'ticker',
      layoutMode: 'card-only',
      backgroundPreset: 'spotlight',
      cardContent: `Content as Code
程式即內容
一次定義
多格式輸出
影片・簡報・文件`,
      narration: 'TickerCard 大字報模式搭配 spotlight 聚光背景，適合金句或重點宣言。',
      durationInSeconds: 8,
    },
    {
      id: 'demo_ticker_kinetic',
      contentType: 'ticker',
      layoutMode: 'card-only',
      backgroundPreset: 'spotlight',
      tickerStyle: 'kinetic',
      cardContent: `Welcome to\nthe Future\nof AI`,
      narration: 'Kinetic Typography 逐字彈入風格，更有衝擊力的視覺體驗。',
      durationInSeconds: 8,
    },

    // ============================================
    // 11. FlowchartCard — OAuth 2.0 授權流程
    // ============================================
    {
      id: 'demo_flowchart',
      contentType: 'flowchart',
      layoutMode: 'card-only',
      backgroundPreset: 'minimal',
      cardTitle: 'OAuth 2.0 Authorization Code Flow',
      flowchartDirection: 'TB',
      flowchartNodes: [
        { id: 'client', label: 'Client App', icon: '🧑‍💻' },
        { id: 'auth', label: 'Auth Server', icon: '🔐' },
        { id: 'code', label: 'Authorization Code', icon: '🎟️' },
        { id: 'token', label: 'Access Token', icon: '🪪' },
        { id: 'api', label: 'API Server', icon: '🗄️' },
        { id: 'data', label: 'Protected Data', icon: '📦' },
      ],
      flowchartEdges: [
        { from: 'client', to: 'auth', label: '1. GET /authorize' },
        { from: 'auth', to: 'code', label: '2. issue code' },
        { from: 'code', to: 'client', label: '3. redirect back' },
        { from: 'client', to: 'token', label: '4. POST /token' },
        { from: 'token', to: 'client', label: '5. access token' },
        { from: 'client', to: 'api', label: '6. Bearer token' },
        { from: 'api', to: 'data', label: '7. response' },
      ],
      flowchartFocusOrder: ['client', 'auth', 'code', 'token', 'api', 'data'],
      narration: 'OAuth 2.0 授權碼流程：用戶端先取得授權碼，再換 access token，最後帶 token 呼叫 API。',
      durationInSeconds: 30,
    },

    // ============================================
    // 12. SummaryCard — fullscreen 結尾
    // ============================================
    {
      id: 'ending',
      contentType: 'summary',
      layoutMode: 'fullscreen',
      backgroundPreset: 'aurora',
      effect: 'fadeIn',
      summaryTitle: '功能總覽回顧',
      summaryPoints: [
        '11 種卡片類型：從文字到數據，到時間軸',
        '3 種佈局模式：title-card / card-only / fullscreen',
        '5 種背景預設：default / gradient-mesh / aurora / spotlight / minimal',
        '進場特效：fadeIn / slideUp / slideLeft / scaleUp',
        'Agent 可自由組合生成 Demo、Tutorial、Guide',
      ],
      summaryCtaButtons: [
        { label: '訂閱頻道', icon: '🔔' },
        { label: '按讚支持', icon: '👍' },
      ],
      summaryShowCta: true,
      narration: '以上就是 Agentic Remotion Studio 的完整功能展示。每個 Step 都可以自由組合卡片類型、佈局和背景。',
      durationInSeconds: 7,
    },
  ],
};
