/**
 * @episode Demo Recording
 * @description ARS onboarding walkthrough episode
 */

import { Episode } from "../../engine/shared/types";

const onboardSession = {
  appTitle: "ARS#1.0.0 template/ep-demo",
  workflow: "walkthrough › bootstrap › customize › verify",
  version: "Claude Code v2.1.112",
  model: "Sonnet 4.6 with high effort · Claude Max",
  workspace: "~/cowork-workspace/template-series",
  badges: [{ label: "onboard", tone: "info" }],
} as const;

const episodeSession = {
  appTitle: "ARS#1.0.0 your-series/ep001",
  workflow: "plan › build › review › prepare › publish",
  version: "Claude Code v2.1.112",
  model: "Sonnet 4.6 with high effort · Claude Max",
  workspace: "~/cowork-workspace/your-series",
  badges: [{ label: "episode", tone: "warning" }],
} as const;

const analyticsSession = {
  appTitle: "ARS#1.0.0 your-series/ep001",
  workflow: "publish › analytics",
  version: "Claude Code v2.1.112",
  model: "Sonnet 4.6 with high effort · Claude Max",
  workspace: "~/cowork-workspace/your-series",
  badges: [{ label: "analytics", tone: "info" }],
} as const;

const walkthroughScene = [
  { type: "section", text: "walkthrough" },
  {
    type: "prompt",
    text: "/ars:onboard",
  },
  {
    type: "assistant",
    text: "ARS 會先帶你看一遍 demo，再進到 series customize，最後做 verify。",
  },
  { type: "tool", text: "Open review studio in background", meta: "template/ep-demo" },
  { type: "result", text: "localhost:5177/?series=template&ep=ep-demo" },
  {
    type: "assistant",
    text: "Browse 完之後回我 next 繼續 Phase 2，或 skip 跳過 walkthrough；Studio 先不要關，後面的 customize 還會繼續用這個預覽。",
  },
  {
    type: "prompt",
    text: "next",
  },
  {
    type: "success",
    text: "walkthrough 完成：demo 看完，流程往 bootstrap 前進。",
  },
  {
    type: "assistant",
    text: "下一步：進 Phase 2 bootstrap，先把 series name、TTS、YouTube 這些確定性設定搞定。",
  },
] as const;

const bootstrapScene = [
  { type: "section", text: "bootstrap" },
  {
    type: "assistant",
    text: "bootstrap 只處理確定性設定，不需要思考品牌方向。三個問題搞定。",
  },
  {
    type: "prompt",
    text: "series name: my-channel",
  },
  {
    type: "tool",
    text: "Run npx ars init my-channel --skip-series -y",
    meta: "repo init",
    details: [
      { text: "sync engine files + patch CLAUDE.md + install skills", tone: "positive" },
      { text: "skip template copy (customize phase handles this)", tone: "muted" },
    ],
  },
  {
    type: "prompt",
    text: "TTS: minimax, YouTube: disabled",
  },
  {
    type: "tool",
    text: "Update(.ars/config.json)",
    meta: "bootstrap output",
    details: [
      { text: "tts.provider = minimax", tone: "positive" },
      { text: "publish.youtube.enabled = false", tone: "muted" },
      { text: "project.activeSeries = my-channel", tone: "positive" },
    ],
  },
  {
    type: "success",
    text: "bootstrap 完成：repo 初始化 + config 寫入，接下來進 customize。",
  },
  {
    type: "assistant",
    text: "下一步：進 Phase 3 customize，選 from template 或 from scratch，再決定品牌細節。",
  },
] as const;

const customizeScene = [
  { type: "section", text: "customize" },
  {
    type: "assistant",
    text: "接下來是 customize。先選模式；如果大部分設定沿用，你也可以直接貼補充資料，不用每題都重答。",
  },
  {
    type: "prompt",
    text: "from template",
  },
  {
    type: "assistant",
    text: "好，那就保留 demo episode 當參考，系列品牌與預設接下來交給你的 series-config.ts 和 SERIES_GUIDE.md。Studio 先一路開著，等等直接刷新看 customize 後的樣子；我也會同步開 comment monitor，主動輪詢 Studio intents。",
  },
  {
    type: "prompt",
    text: "你幫我改一下 @SERIES_GUIDE.md，參考這份團隊背景頁面",
  },
  {
    type: "result",
    text: "Read SERIES_GUIDE.md (60 lines)",
  },
  {
    type: "assistant",
    text: "先用 Notion MCP 抓頁面內容。",
  },
  {
    type: "tool",
    text: "Called Notion",
    meta: "ctrl+o to expand",
  },
  {
    type: "assistant",
    text: "內容很豐富，現在根據這份人物誌更新 SERIES_GUIDE.md。",
  },
  {
    type: "assistant",
    text: "根據人物誌內容，主要需要更新的是 Series Identity 和 Narration Voice。",
  },
  {
    type: "tool",
    text: "Update(SERIES_GUIDE.md)",
    meta: "customize output",
    details: [
      { text: "Series Identity: host / audience / mission / language synced from Notion brief", tone: "positive" },
      { text: "Narration Voice: opening style / banned phrases / rhythm updated from人物誌", tone: "positive" },
      { text: "visual defaults stay on template unless user explicitly asks to change them", tone: "muted" },
    ],
  },
  {
    type: "success",
    text: "customize 完成：大部分沿用 template，額外資料直接從 Notion 補進 SERIES_GUIDE.md。現在回到仍然開著的 Studio 重新整理，檢查預覽和留言；進 verify 前我會先把 pending intents 清乾淨。",
  },
  {
    type: "assistant",
    text: "下一步：進 Phase 3 verify，跑 doctor 把 config、provider、plugin 狀態確認乾淨。",
  },
] as const;

const verifyScene = [
  { type: "section", text: "verify" },
  { type: "assistant", text: "最後跑 doctor，確認整個 repo 已經 ready。Studio 先保持開著，verify 期間 comment monitor 會繼續輪詢；如果有新的預覽留言就一起收斂。" },
  { type: "tool", text: "Run doctor", meta: "npx ars doctor" },
  { type: "result", text: "config.exists ............. pass  Loaded .ars/config.json" },
  { type: "result", text: "config.active-series ...... pass  activeSeries=your-series" },
  { type: "result", text: "engine.install ............ pass  remotion + vite ready" },
  { type: "result", text: "plugin.assets ............. pass  onboard skill + shared assets synced" },
  { type: "result", text: "provider.minimax .......... pass  MiniMax configured but disabled in series-config.ts" },
  { type: "result", text: "provider.youtube .......... pass  YouTube publishing disabled." },
  { type: "tool", text: "Drain pending Studio intents, stop comment monitor, close background Studio", meta: "onboard teardown" },
  { type: "tool", text: "Clear workstate + stamp onboardedAt", meta: "onboard complete" },
  { type: "success", text: "doctor clean — onboardedAt stamped，comment monitor 與 onboarding Studio 都已關閉，ready to start the first episode." },
  { type: "assistant", text: "下一步：可以直接輸入 /ars:plan <topic>，或如果 ep 已存在就跑 /ars:build <epId>。" },
] as const;

const episodeMontage = [
  { type: "section", text: "episode" },
  {
    type: "prompt",
    text: "/ars:plan 參考這份研究筆記做一集",
  },
  {
    type: "assistant",
    text: "素材很完整（Notion 頁面已有核心觀點、大綱、製作筆記），SERIES_GUIDE.md 也已設好。",
  },
  {
    type: "tool",
    text: "ars:planner(Plan ep025 NVIDIA/TSMC AI 生態鏈)",
    meta: "plan",
    details: [
      { text: "write .ars/episodes/ep025/plan.md", tone: "positive" },
      { text: "define hook / body sections / runtime range / card mix", tone: "muted" },
    ],
  },
  {
    type: "success",
    text: "Plan 完成。下一步：/ars:build ep025 生成 step cards 和 narration。",
  },
  { type: "prompt", text: "/ars:build ep025" },
  {
    type: "tool",
    text: "ars:builder(Build ep025 from approved plan)",
    meta: "build",
    details: [
      { text: "write src/episodes/your-series/ep001.ts", tone: "positive" },
      { text: "sync narration / step durations / card data from plan.md", tone: "muted" },
    ],
  },
  {
    type: "success",
    text: "Build 完成。下一步：/ars:review ep025 檢查畫面、字稿、節奏。",
  },
  { type: "prompt", text: "/ars:review ep025" },
  {
    type: "tool",
    text: "Open review studio",
    meta: "review",
    details: [
      { text: "localhost:5177/?series=your-series&ep=ep001", tone: "info" },
      { text: "review script / visuals / timing, then patch if needed", tone: "muted" },
    ],
  },
  {
    type: "assistant",
    text: "Review 完成，stage 已推進。下一步：/ars:prepare-youtube ep025 整理 metadata 和上傳。",
  },
  { type: "prompt", text: "/ars:prepare-youtube ep025" },
  {
    type: "tool",
    text: "Prepare YouTube package",
    meta: "prepare",
    details: [
      { text: "generate title / description / tags / thumbnail metadata", tone: "positive" },
      { text: "assemble publish payload and final metadata", tone: "muted" },
    ],
  },
  {
    type: "prompt",
    text: "/ars:publish-youtube ep025",
  },
  {
    type: "tool",
    text: "Publish YouTube video",
    meta: "publish",
    details: [
      { text: "upload video as private", tone: "positive" },
      { text: "return watch URL + publish metadata", tone: "muted" },
    ],
  },
  {
    type: "success",
    text: "ep025 已全部完成。影片已上傳至 YouTube（private），URL：https://youtube.com/watch?v=i6SLgOu231k",
  },
  {
    type: "assistant",
    text: "下一步：換下一個題目，重新從 /ars:plan 開始整個 episode loop。",
  },
] as const;

const analyticsScene = [
  { type: "section", text: "analytics" },
  {
    type: "prompt",
    text: "/ars:analytics 幫我看看最近三十天的數據",
  },
  {
    type: "assistant",
    text: "先讀 YouTube client 工具和頻道設定，確認 Analytics API 介面。",
  },
  {
    type: "tool",
    text: "Query YouTube Analytics API",
    meta: "last 30 days",
    details: [
      { text: "views / watch time / avg view duration / subscribers", tone: "positive" },
      { text: "daily trend + top videos by views", tone: "muted" },
    ],
  },
  {
    type: "result",
    text: 'CHANNEL: {"viewCount":"19068","subscriberCount":"383","videoCount":"37"}',
  },
  {
    type: "tool",
    text: "Write(.ars/analytics/2026-04-17-30d.md)",
    meta: "analytics report",
    details: [
      { text: "30-day KPI snapshot + spike windows + top videos", tone: "positive" },
      { text: "risk summary + next content suggestions", tone: "muted" },
    ],
  },
  {
    type: "assistant",
    text: "近 30 天觀看 11,875、淨訂閱 +312。兩波爆量集中在 Claude Code 小秘訣和工具清單題材。",
  },
  {
    type: "assistant",
    text: "下一步：把這些 insight 帶回下一輪 plan / reflect，讓題材、CTA 和節奏持續修正。",
  },
] as const;

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
        title: "Agentic Remotion Studio",
        subtitle: "你不是在做一支片，你是在啟動一套影片系統",
        episodeTag: "REAL WORKFLOW DEMO",
        animation: "matrix",
      },
      narration: "這不是概念展示，而是你接下來可以在自己系列裡反覆使用的影片工作流。你看到的不是單一指令，而是從 onboard、審稿到 analytics 都接在一起的一套系統。",
      durationInSeconds: 6,
    },
    {
      id: "ars-overview",
      contentType: "markdown",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        cardTitle: "Why ARS",
        cardTag: "Feature Set",
        tagColor: "info",
        content: [
          "# ARS 的功能特點",
          "",
          "- Agentic Remotion Studio，為影片製作而生",
          "- 從風格規範、影片生成到成效分析，一體化完成",
          "- Studio Web UI，無縫預覽與 Agent 協作",
          "- 內建 feedback loop，讓內容持續演進",
          "- 快速安裝：`ars init <series>`",
        ].join("\n"),
      },
      narration: "這頁先用四個 feature 交代 ARS 是什麼樣的系統。它不是單點工具，而是把規範、生成、預覽協作和 feedback loop 放在同一套工作流裡。",
      durationInSeconds: 8,
    },
    {
      id: "walkthrough",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        tag: "WALKTHROUGH",
        session: onboardSession,
        lines: walkthroughScene,
      },
      narration: "walkthrough 的目標很單純，就是先把 demo 開起來，讓使用者快速理解 ARS 的整體畫面和節奏。看完之後，流程才會往 customize 推進。",
      durationInSeconds: 8,
    },
    {
      id: "bootstrap",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        tag: "BOOTSTRAP",
        session: onboardSession,
        lines: bootstrapScene,
      },
      narration: "bootstrap 只問三件事：series name、TTS provider、YouTube 要不要開。這些都是確定性的設定，不需要想品牌方向。",
      durationInSeconds: 8,
    },
    {
      id: "customize",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        tag: "CUSTOMIZE",
        session: onboardSession,
        lines: customizeScene,
      },
      narration: "customize 不一定要把所有問題重答一遍。像這裡就是保留 demo 當參考，再補一份團隊背景資料，讓 agent 把新的系列脈絡寫回 SERIES_GUIDE.md。",
      durationInSeconds: 14,
    },
    {
      id: "verify",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        tag: "VERIFY",
        session: onboardSession,
        lines: verifyScene,
      },
      narration: "verify 這段負責把 onboard 收乾淨。agent 會用 doctor 檢查 config、engine、plugin 和 provider，全部通過之後再把 onboarded 狀態正式標記完成。",
      durationInSeconds: 10,
    },
    {
      id: "episode",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        tag: "EPISODE",
        session: episodeSession,
        lines: episodeMontage,
      },
      narration: "onboard 做完之後，後面的每一集就是同一條流水線的接力。這裡只用一張 montage 快速帶過 plan、build、review、prepare 和 publish 各自負責什麼。",
      durationInSeconds: 15,
    },
    {
      id: "analytics",
      contentType: "claude-code",
      layoutMode: "card-only",
      background: "minimal",
      data: {
        tag: "ANALYTICS",
        session: analyticsSession,
        lines: analyticsScene,
      },
      narration: "golden set 的尾巴不是停在 publish。影片發出去之後，還會拉最近三十天的 analytics，寫成報告，然後把觀看、訂閱和題材表現回流到下一輪 plan 和 reflect。",
      durationInSeconds: 12,
    },
    {
      id: "review-studio-ui",
      contentType: "image",
      layoutMode: "fullscreen",
      background: "minimal",
      data: {
        title: "Review Studio",
        src: "/episodes/template/shared/review-studio/review-studio-ui.png",
        objectFit: "contain",
      },
      narration: "這頁真正要講的不是右邊的 editor，而是畫面上的 ✨ 回饋入口。你可以直接從 Studio 預覽送出修改意圖，背景的 Claude Code 會即時改 step，改完再立刻回到這個畫面確認結果。",
      durationInSeconds: 8,
    },
    {
      id: "ending",
      contentType: "summary",
      layoutMode: "fullscreen",
      background: "aurora",
      data: {
        title: "這不是單次 demo",
        points: [
          "先 onboard，建立系列記憶",
          "再用 Studio 與 Agent 持續修改",
          "最後把 analytics 帶回下一輪",
        ],
        ctaButtons: [
          { label: "/ars:onboard", icon: "🎬" },
          { label: "Run /ars:doctor", icon: "🩺" },
        ],
        showCta: true,
      },
      narration: "ARS 不是做完一支片就結束。它把系列設定、製作、審稿和 analytics 接成一條會持續演進的 workflow。接下來你可以直接從自己的系列主題開始進入下一輪 plan。",
      durationInSeconds: 7,
    },
  ],
};
