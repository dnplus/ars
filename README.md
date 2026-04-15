# ARS — Animated Review Studio

ARS 是一個開源的動畫內容製作工具，整合 **Claude Code 外掛** + **全域 CLI 工具**，幫助你用 Remotion 製作動畫 Episode，並透過互動式 Studio 進行審視和修正。

## 🎯 核心功能

- **引擎驅動製作**：基於 Remotion 的動畫引擎，支援卡片系統、主題、佈局、故事線連續性規則
- **Claude Code 整合**：`/ars-review` slash command 自動修正迴圈，搭配 ARS plugin 可獲得更多場景規劃技能
- **互動式審視**：Studio UI 實時預覽 episode，用 ✨ 按鈕標記視覺 / 內容 / 時序問題
- **自動修正流程**：將審視意見寫入修正清單，Claude Code 自動套用修正後重新渲染
- **YouTube 發佈**：兩段式發佈流程（準備 → 確認 → 上傳）

## 📦 安裝配置

### 前置條件
- Node.js >= 22.12.0
- Claude Code CLI 已安裝
- 你的頻道 repo（空或既有 Remotion 專案）

### 1. 安裝 ARS 全域 CLI

```bash
npm install -g agentic-remotion-studio
```

或從本地開發：
```bash
npm install
npm link
```

### 2. 初始化你的頻道 repo

在你的頻道 repo 根目錄執行：

```bash
ars setup
```

這會：
- 複製 ARS 引擎到 `src/engine/`
- 建立 `.ars/config.json`（設定 TTS、發佈、review UI）
- 建立 `src/episodes/template/` 示範
- Patch `CLAUDE.md`（加入 ARS 使用提示）

選項：
- `--force` — 覆寫所有檔案
- `--force-engine` — 只重新複製引擎
- `--yes` — 跳過互動確認，使用預設值

### 3. 驗證安裝

```bash
ars doctor
```

檢查項目：
- ✅ `.ars/config.json` 存在且有效
- ✅ 引擎版本符合
- ✅ Claude Code plugin 已安裝
- ✅ TTS / YouTube 憑證（若需要）

## 🎬 快速開始

### 建立新 Episode

```bash
ars episode create <series>/<epId>
```

例如：
```bash
ars episode create gss/ep-my-topic
```

這會：
- 在 `src/episodes/gss/` 建立 `ep-my-topic.ts`
- 建立 `public/episodes/gss/ep-my-topic/` 資料夾（音訊、demo 素材）
- 複製模板結構，你可以開始編寫 episode

### 在 Claude Code 中規劃場景

直接在 Claude Code 描述你要的內容，讓 Claude 幫你規劃並填寫 episode 的 steps。若安裝了 ARS plugin，可使用 `/scene-plan` 等技能快速產生場景規劃。

### 編寫 Episode

根據場景規劃，編寫 `src/episodes/gss/ep-my-topic.ts`：

```typescript
import { Episode } from '../src/engine/types';

export const episode: Episode = {
  metadata: {
    id: 'ep-my-topic',
    series: 'gss',
    title: '我的主題',
    width: 1920,
    height: 1080,
    fps: 30,
  },
  shell: {
    theme: { /* ... */ },
  },
  steps: [
    {
      id: 'intro',
      durationInSeconds: 5,
      card: { type: 'cover', content: { /* ... */ } },
    },
    // ...更多 steps
  ],
};
```

## 🎨 啟動 Studio Review

### 開啟 Studio

```bash
ars review open gss/ep-my-topic
```

這會：
1. 啟動 Vite dev server（通常在 `http://localhost:5173`）
2. 開啟瀏覽器的 Studio UI
3. 實時渲染 episode

### 審視介面

Studio 介面：

| 元素 | 位置 | 用途 |
|------|------|------|
| **✨ 卡片** | 畫面左上角 | 標記卡片視覺問題 |
| **✨ 口播** | 字幕列左側 | 標記旁白 / 文案問題 |
| **✨ 整集** | 導覽列中央 | 記錄整集層級的問題 |
| **📋 修正清單** | 導覽列右側 | 展開側欄顯示所有修正狀態 |
| **📊 步驟資訊** | 導覽列右側 | 顯示 duration、語音生成狀態、口播字數等 |
| **⛶ 全螢幕** | 導覽列右側 | 展開全螢幕檢視 |

### 標記修正

1. 看到需要改的地方，點對應的 **✨** 按鈕
2. 在彈出框輸入修正說明，例如「標題太擠，改成圖片優先的構圖」
3. ⌘↵ 或點「送出」，修正立即寫入 `.ars/review-intents/` 並更新清單

修正會立即寫入 `.ars/review-intents/` 資料夾（本地檔案，不會 git commit）。修正清單會自動更新。

## 🔧 自動修正流程

### 在 Claude Code 中執行修正

在對話框執行：
```
/ars-review gss/ep-my-topic
```

Claude 會：
1. 啟動 Studio（同步進行）
2. 進入監看迴圈，每 30 秒檢查一次 `.ars/review-intents/`
3. 對每個待處理修正：
   - 讀取意見（目標 step、修正類型、說明）
   - 修改 episode source（`src/episodes/gss/ep-my-topic.ts`）
   - 標記已完成
   - 回報修正內容
4. 你在 Studio 看到即時更新的預覽
5. 可繼續標記修正，或輸入 `stop` 結束

**規則**：
- 修正只針對目標 step，不涉及其他 step
- 內容修正專注文案 / 旁白
- 視覺修正涉及卡片 props、佈局、樣式
- 修正後會執行 TypeScript 檢查，確保無誤

## 💾 其他常用指令

### Episode 管理

```bash
# 列出某系列的所有 episode
ars episode list gss

# 驗證 episode 結構
ars episode validate gss/ep-my-topic

# 查看 episode 使用的卡片類型統計
ars episode stats gss/ep-my-topic
```

### Review Intent 管理

```bash
# 列出所有修正意見（按狀態分組）
ars review intent list

# 查看特定修正意見詳情
ars review intent show <id>

# 標記修正已完成
ars review intent clear <id>

# 一次性標記全部已完成
ars review intent clear all
```

### 更新引擎

```bash
ars update
```

重新複製最新版 ARS 引擎，舊版本自動 backup 到 `.ars/backups/<timestamp>/`。

## ⚙️ 設定檔 `.ars/config.json`

`ars setup` 建立的預設設定：

```json
{
  "tts": {
    "provider": "none"
  },
  "publish": {
    "youtube": { "enabled": true }
  },
  "extensions": {
    "social": { "enabled": false },
    "analytics": { "enabled": false }
  },
  "review": {
    "preferredUi": "slides",
    "enableExperimentalStudio": false
  }
}
```

| 設定 | 說明 |
|------|------|
| `tts.provider` | TTS 服務商（`none` = 關閉，`minimax` = MiniMax） |
| `publish.youtube.enabled` | 是否支援 YouTube 發佈 |
| `review.preferredUi` | Review 介面（`slides` = 預設） |

## 📝 Episode 檔案結構

```
src/episodes/
├── gss/
│   ├── ep-my-topic.ts          # Episode 定義
│   └── ...更多 episodes
├── template/
│   └── episode.template.ts      # 建立 episode 時複製的模板
```

每個 episode 遵循 `Episode` type 定義：

```typescript
type Episode = {
  metadata: {
    id: string;                   // Episode ID（同檔名）
    series: string;               // 系列名稱
    title: string;                // 顯示標題
    width: number;                // 寬度（px）
    height: number;               // 高度（px）
    fps: number;                  // 幀率
  };
  shell: {
    theme: Theme;                 // 全集主題、配色、字型
  };
  steps: Step[];                  // 動畫步驟陣列
};
```

## 🎨 卡片系統

ARS 內建常用卡片類型：

| 卡片 | 用途 |
|------|------|
| `cover` | 封面 / 標題頁 |
| `code` | 程式碼片段 |
| `image` | 圖片 + 文案 |
| `markdown` | Markdown 內容 |

在 step 的 `card` 欄位指定類型和內容，例如：

```typescript
{
  id: 'intro',
  durationInSeconds: 5,
  card: {
    type: 'cover',
    content: {
      title: '我的影片',
      subtitle: '一個引人入勝的故事',
    },
  },
}
```

## 🌐 發佈到 YouTube

### 準備發佈

```bash
ars prepare youtube gss/ep-my-topic
```

產生發佈候選稿：
- 檢查所有 step 完整性
- 生成 Remotion render command
- 產生 YouTube 中繼資料預覽

或試跑：
```bash
ars prepare youtube gss/ep-my-topic --dry-run
```

### 發佈

```bash
ars publish youtube gss/ep-my-topic
```

執行：
- 本地 render & package（如果需要）
- 上傳到 YouTube（需要設定 YouTube API 憑證）
- 回報上傳 URL

## 🛠️ 開發工作流

### 本地開發

```bash
npm run dev           # 啟動 Remotion Studio（開發 engine）
npm run build         # 打包 production 版本
npm run lint          # ESLint + TypeScript 檢查
npm run test          # 單元測試
```

### 在自己的 repo 中開發

```bash
cd <my-channel-repo>
npm run dev:studio    # 啟動 ARS Studio（review 你的 episodes）
```

## 🐛 疑難排解

### doctor 出現失敗

執行 `ars doctor` 查看詳細錯誤，按提示修復：

```bash
ars doctor --json    # 輸出 JSON 格式，便於解析
```

常見問題：
- **Missing .ars/config.json** — 執行 `ars setup --yes`
- **Version drift** — 執行 `ars update`
- **Missing plugin** — 在 Claude Code 確認 ARS plugin 已安裝

### Episode 驗證失敗

```bash
ars episode validate gss/ep-my-topic
```

檢查：
- 所有 step 都有 `id` 和 `durationInSeconds`
- 卡片類型在 registry 中
- TypeScript 無型別錯誤

### Studio 無法啟動

1. 確保 `npm install` 已完成
2. 檢查 port 5173 未被佔用（或改用其他 port）
3. 查看 Vite 輸出是否有 build 錯誤

## 📚 相關文件

- **PRD 詳細規格**：`ARS-CE-PRD.md`
- **Claude Code 整合**：`.claude/commands/ars-review.md`

## 💡 使用提示

- **模組化 episode**：一個 series 內分多個 episodes，便於管理和 review
- **定期存檔**：修正完成後提交 `src/episodes/` 到版控
- `.ars/config.json` 和 `.ars/review-intents/` 已 gitignored，不會進版控
- 使用 `ars update` 同步最新引擎功能，舊版自動備份

---

**ARS CE** 採 OMC-style 開源模式，plugin + global CLI 雙件製品。歡迎貢獻！
