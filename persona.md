# Made For Who

> ARS 是給「會寫一點 code、穩定更新系列、想讓工作流跨集累積」的 indie YouTuber 的影片生產系統。

## 誰適合用

### Primary persona — Agentic Indie Creator（代理式獨立創作者）

- 常見身份：技術教育者、VTuber、founder-led 頻道，經營有主題軸的系列節目
- 已經熟：Claude Code、一點 Remotion / React / TypeScript、終端機不陌生
- 更新節奏：週更或雙週更，主題軸清楚，系列有自己的品牌記憶
- 痛點：剪輯時間軸、字幕對時吃掉整個週末；每集都從零開始，經驗不累積
- Flagship reference：**人蔘 Try Catch**（@ginsengtrycatch）— 驅動 ARS 開發的系列，也是 `ep-demo.ts` 的主角

### Secondary persona — Technical Educator / Developer Advocate

- 想把 blog post、Notion 筆記變成影片，但不想找剪輯師
- 在意：code block 呈現乾淨、`claude-code` card、mermaid diagram、字幕易讀
- 追求「講清楚 + 快速出下一集」，不追求電影級後製

## 誰不適合用

把邊界講清楚，避免互相浪費時間：

- 完全不碰終端機的 creator — onboarding 直接假設你會用 Claude Code
- Vlog、遊戲實況、音樂 MV — 這類不是卡片式解說內容，ARS 幫不上忙
- 需要多平台同步（TikTok / IG / FB）— core 明確只支援 YouTube
- 一次性品牌影片或活動回顧 — `SERIES_GUIDE.md` 和 analytics 迴圈是「跨集複利」才划算
- 想要純 GUI、零 code 的使用者 — Studio 是預覽 + 回饋層，不是取代編輯器

## 你需要帶什麼進來

硬需求：

- Node.js >= 22.12.0
- Claude Code CLI（plugin 是主要介面，沒裝就沒 skill 可用）
- YouTube channel + OAuth（core 唯一的 publish target）
- TTS provider API key（MiniMax、ElevenLabs…）

加分項（沒有也能起步，但 ARS 預設你會有）：

- Notion workspace — `/ars:plan` 可以直接吃 Notion URL（透過 MCP）
- 清楚的系列主題軸（科技、開發教學、產業分析…）
- VTuber 角色 或 品牌視覺系統 — `shell.config.vtuber` 是一級 feature
- 願意跑完整迴圈：publish → analytics → reflect → 下一集

## 你會拿到什麼

- 一個 repo = 一個 series：視覺風格、VTuber、語氣全寫在 `SERIES_GUIDE.md`，跨集保持一致
- 從 Notion / URL / 筆記一路到 YouTube publish 的 agent-assisted 流水線
- Studio 即時預覽 + review intent 回饋迴圈 — 告別「render → 看 → 改 → render」的等待
- YouTube analytics 透過 `/ars:reflect` 回灌系列策略，讓題材選擇不只靠直覺

## 為什麼是這樣設計

- **Plugin-first**：workflow 決策需要 human-in-the-loop，只有對話式 skill 介面跑得動這個迴圈
- **One repo, one series**：系列記憶（guide、custom cards、VTuber assets）需要一個可以累積的地方
- **核心只做 YouTube**：多平台 orchestration 是不同問題，硬塞進 core 會稀釋品質。需要的人請做成 extension

## 實戰證據

**人蔘 Try Catch**（@ginsengtrycatch）就是 ARS 的 dogfood 系列。`ep-demo` 裡的真實數字：

- 累計 37 部影片、383 訂閱、約 1.9 萬次觀看
- 近 30 天 snapshot：11,875 views、淨訂閱 +312
- 節目編號落在 ep025 附近，代表這套 workflow 已經壓力測試了 20+ 輪完整週期 — onboard、plan、review、publish、reflect 都跑過真實使用場景

如果你的輪廓對得上，這就是為你做的。
