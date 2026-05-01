/**
 * @episode Demo Recording
 * @description ARS onboarding walkthrough episode
 */

import { Episode } from "../../engine/shared/types";

export const epDemo: Episode = {
  metadata: {
    title: "Agentic Remotion Studio",
    subtitle: "Onboard 先把 repo 準備好，後面每一集才接得上",
    skipAudio: true,
    thumbnail: {
      variants: [
        {
          id: "v1",
          cardType: "thumbnail",
          label: "直述標題",
          data: {
            title: "先訂 persona.md",
            subtitle: "AI 自己推出下一步",
            episodeTag: "DEMO",
          },
        },
        {
          id: "v2",
          cardType: "thumbnail",
          label: "反問鉤子（無吉祥物）",
          data: {
            title: "你真的需要腳本嗎？",
            subtitle: "讓 ARS 替你決定下一步",
            episodeTag: "DEMO",
            mascotUrl: "none",
          },
        },
        {
          id: "v3",
          cardType: "thumbnail",
          label: "大字衝擊（無吉祥物）",
          data: {
            title: "影片系統",
            subtitle: "onboard 到 analytics，一條流水線",
            episodeTag: "DEMO",
            mascotUrl: "none",
          },
        },
      ],
      primary: "v1",
    },
  },

  steps: [
    {
      id: "intro",
      contentType: "cover",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        title: "這是一個預設展示頁面",
        subtitle: "請把它當作你的系列模板試衣間",
        episodeTag: "ONBOARD PREVIEW",
        animation: "matrix",
      },
      narration: "你現在看到的是 ARS 預設展示頁面。請先左右瀏覽每種卡片；看到不符合你系列風格的地方，可以點下方留言，或選取畫面元件留言。這些留言預設會影響以後每支影片的模板；如果只是這一頁臨時要改，留言時再說只改這一頁。",
      durationInSeconds: 6,
    },
    {
      id: "ars-system-map",
      contentType: "image",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "ARS system map",
        src: "/episodes/template/shared/onboard/ars-system-map.svg",
        objectFit: "contain",
      },
      narration: "先把地圖攤開。ARS 不是只幫你做出一支影片，而是把素材、agent 工作流、Remotion source、Studio review、publish 和 analytics 接成一條會回饋的製作線。",
      durationInSeconds: 7,
    },
    {
      id: "init-onboard-episode",
      contentType: "image",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "Init onboard episode",
        src: "/episodes/template/shared/onboard/init-onboard-episode.svg",
        objectFit: "contain",
      },
      narration: "所以第一步不是馬上寫腳本。init 先建立 repo 和預設；onboard 再建立系列記憶；真正開始做每一集時，才進入 plan、build、review、prepare 和 publish 的循環。",
      durationInSeconds: 8,
    },
    {
      id: "studio-feedback-loop",
      contentType: "image",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "Studio feedback loop",
        src: "/episodes/template/shared/onboard/studio-feedback-loop.svg",
        objectFit: "contain",
      },
      narration: "Studio 在這裡不是播放器而已。你在畫面上留言，會變成 Studio intent；agent 依照 onboard 或 review 的階段去改系列設定、SERIES_GUIDE，或 episode 裡的 step 和 card data。",
      durationInSeconds: 8,
    },
    {
      id: "card-system",
      contentType: "image",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "Card system",
        src: "/episodes/template/shared/onboard/card-system.svg",
        objectFit: "contain",
      },
      narration: "接下來不是再演一次 onboarding，而是直接看卡片系統。ARS 的每一頁都是一個 card。你可以先用 built-in cards，也可以為自己的系列新增卡片，甚至用同一個 type 覆蓋內建卡片，變成自己的預設樣式。",
      durationInSeconds: 10,
    },
    {
      id: "gallery-cover",
      contentType: "cover",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        title: "Cover",
        subtitle: "開場、章節切換、重大轉折",
        episodeTag: "DEFAULT CARD",
        animation: "matrix",
      },
      narration: "cover 是影片開場、章節切換和重大轉折最常用的卡片。onboard 時如果你希望 cover 以後固定改成藍色、放 logo、移除 channel name，這應該被當成系列模板需求，而不是只修這一張 demo。",
      durationInSeconds: 8,
    },
    {
      id: "gallery-markdown",
      contentType: "markdown",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        cardTitle: "Markdown",
        content: [
          "# 適合整理觀點",
          "",
          "- 條列關鍵結論",
          "- 補充必要上下文",
          "- 保持密度可讀，不要把整篇稿塞進一張卡",
        ].join("\n"),
      },
      narration: "markdown 卡適合放重點、定義、對照或短段落。你可以在 Studio 上直接留言調整字級、密度、標題風格，這些會進入系列的卡片偏好。",
      durationInSeconds: 8,
    },
    {
      id: "gallery-image",
      contentType: "image",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "Image",
        src: "/episodes/template/shared/review-studio/review-studio-ui.png",
        objectFit: "contain",
      },
      narration: "image 卡用來展示截圖、證據圖、產品畫面或品牌素材。這也是 onboard 階段很適合調整的地方：圖片要不要加框、要不要滿版、背景要不要更像你的頻道。",
      durationInSeconds: 8,
    },
    {
      id: "gallery-mermaid",
      contentType: "mermaid",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        title: "Mermaid",
        chart: [
          "flowchart LR",
          "  A[Source material] --> B[Plan]",
          "  B --> C[Build cards]",
          "  C --> D[Studio review]",
          "  D --> E[Publish]",
          "  E --> F[Reflect]",
        ].join("\n"),
      },
      narration: "mermaid 卡適合流程、架構和依賴關係。如果你覺得這種圖太工程、太白板，onboard intent 可以改成系列偏好，甚至改用 series-scoped custom card 取代。",
      durationInSeconds: 8,
    },
    {
      id: "gallery-code",
      contentType: "code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        title: "series-config.ts",
        language: "ts",
        code: [
          "export const SERIES_CONFIG = {",
          "  project: {",
          "    channelName: 'Your Channel Name',",
          "  },",
          "  theme: {",
          "    primary: '#d4b896',",
          "    surfaceDark: '#211d19',",
          "  },",
          "} satisfies SeriesConfig;",
        ].join("\n"),
      },
      narration: "code 卡用來展示設定、程式片段或指令結果。技術型頻道可以在 onboard 階段決定 code 卡要像 terminal、IDE、還是更像簡報型註解。",
      durationInSeconds: 8,
    },
    {
      id: "gallery-summary",
      contentType: "summary",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        title: "Summary",
        points: [
          "收束一集的三個重點",
          "整理觀眾該帶走的結論",
          "放 CTA、下一步或 QR code",
        ],
        ctaButtons: [
          { label: "/ars:plan <topic>" },
          { label: "Open Studio" },
        ],
        showCta: true,
      },
      narration: "summary 卡通常放在結尾，幫觀眾收束重點、記住下一步。這張也很適合調 CTA 語氣：要低調、要直接、或完全不要 CTA。",
      durationInSeconds: 8,
    },
    {
      id: "gallery-thumbnail",
      contentType: "thumbnail",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "影片系統",
        subtitle: "一次 onboard，重複製作",
        episodeTag: "DEMO",
        mascotUrl: "none",
      },
      narration: "thumbnail 卡用來預覽 YouTube 包裝。當系列要上傳 YouTube 時，標題、縮圖、描述和 tags 會接到 prepare 和 publish 流程。",
      durationInSeconds: 8,
    },
    {
      id: "ending",
      contentType: "summary",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        title: "現在請直接在 Studio 留言",
        points: [
          "哪類卡片不符合你的系列風格？",
          "哪些元素應該變成你的預設模板？",
          "只修 demo 時，請明講「只修這張 demo」",
        ],
        ctaButtons: [
          { label: "next: customize" },
          { label: "leave Studio comments" },
        ],
        showCta: true,
      },
      narration: "這個 demo 現在是你的模板試衣間。看到任何卡片不符合你的系列風格，可以直接在 Studio 留言；agent 會把它當成系列級 customization，除非你明確說只修這張 demo。",
      durationInSeconds: 7,
    },
  ],
};
