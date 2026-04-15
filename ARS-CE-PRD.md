# ARS CE PRD — Agentic Remotion Studio Community Edition

**Version**: 0.1 (Draft)
**Status**: Pre-implementation

---

## 1. Summary

Agentic Remotion Studio（ARS）定位為 **Claude Code plugin + starter repo** 的雙件式開源產品。

- **Plugin**（`/ars:xxx`）：workflow UX 層，負責場景規劃、review 回送、發布指令、setup/doctor
- **Starter repo**：execution layer，負責 episode schema、Remotion engine、cards/layouts、CLI、preview/review UI

兩者在同一個 monorepo 交付。Plugin 掛載在 Claude Code，starter repo 是使用者 clone 下來跑的內容生產環境。

---

## 2. Product Shape

### 2.1 Monorepo 結構

```
agentic-remotion-studio/
├── plugin/                        # Claude Code plugin
│   ├── hooks/
│   │   └── hooks.json             # Claude Code lifecycle hooks
│   ├── agents/
│   │   ├── planner.md             # scene-plan / episode draft（Opus）
│   │   └── publisher.md           # prepare + publish 確認流程（Sonnet）
│   ├── skills/                    # /ars:xxx slash commands
│   │   ├── setup/SKILL.md
│   │   ├── doctor/SKILL.md
│   │   ├── episode-create/SKILL.md
│   │   ├── scene-plan/SKILL.md
│   │   ├── scene-build/SKILL.md
│   │   ├── scene-polish/SKILL.md
│   │   ├── review-open/SKILL.md
│   │   ├── scene-fix/SKILL.md
│   │   ├── prepare-youtube/SKILL.md
│   │   └── publish-youtube/SKILL.md
│   └── scripts/                   # hooks 背後的 Node.js 邏輯
│       ├── keyword-detector.mjs   # 偵測觸發詞
│       ├── session-start.mjs      # SessionStart 健診
│       └── review-intent-stop.mjs # Stop hook 偵測 inbox
├── src/                           # Remotion engine（starter repo）
├── cli/                           # ARS CLI（npx ars）
├── public/                        # 靜態資產
├── skills/                        # 知識 skills（非 plugin slash commands）
│   ├── agentic-remotion-studio/   # ARS 本身的 SKILL.md 與 references
│   └── ...
└── ...
```

### 2.2 Plugin 安裝方式

```bash
# Marketplace 安裝（推薦）
/plugin marketplace add https://github.com/<org>/agentic-remotion-studio
/plugin install agentic-remotion-studio

# 或 npm CLI
npm i -g ars-plugin
```

安裝後在 Claude Code session 內執行 `/ars:setup` 完成初始化。

### 2.3 Skill Frontmatter 格式

每個 skill 都是標準 markdown，YAML frontmatter 定義元資料：

```yaml
---
name: scene-plan
description: 產生 episode 的場景規劃 artifact，分 tier、variant、continuity
argument-hint: "<series>/<epId>"
model: claude-opus-4-6
level: 3
---
```

| 欄位 | 說明 |
|------|------|
| `name` | skill 識別名，對應 `/ars:<name>` |
| `description` | 一行說明，用於 auto-detection context |
| `argument-hint` | 使用者輸入提示 |
| `model` | 預設執行模型（可被 config override）|
| `level` | 複雜度 1–4（1=trivial, 4=full pipeline）|

### 2.4 Agent 設計

ARS CE 只定義兩個 agent，其餘功能走 skill（直接呼叫 CLI）：

| Agent | Model | 職責 | 限制 |
|-------|-------|------|------|
| `planner` | opus | scene-plan、episode draft、continuity 規則 | READ-ONLY，只輸出到 `.ars/scene-plans/` |
| `publisher` | sonnet | prepare → 人工確認 → publish，wraps `npx ars` CLI | 不能自行修改 episode 內容 |

不做角色氾濫。`/ars:setup`、`/ars:doctor`、`/ars:review-open`、`/ars:scene-fix` 都是純 skill（不需要 agent）。

### 2.5 命令集

```
/ars:setup                         # 初始化 .ars/config.json、檢查環境
/ars:doctor                        # 驗證 plugin、CLI、provider config
/ars:episode-create <series>/<epId>
/ars:scene-plan <series>/<epId>    # 產生 .ars/scene-plans/<series>/<epId>.json
/ars:scene-build <series>/<epId>   # 依 plan 套用，不自由發明
/ars:scene-polish <series>/<epId>  # 只處理 B/C tier，受 writeScope 限制
/ars:review-open <series>/<epId>   # 開 slides review（預設）或 studio-exp
/ars:scene-fix [<intent-id>|latest] # 讀 review-intent，針對單一 step 修正
/ars:prepare-youtube <series>/<epId>
/ars:publish-youtube <series>/<epId>

# Extensions（不進 core）
/ars:prepare-social <series>/<epId>
/ars:publish-social <series>/<epId>
/ars:analytics-report
```

命令分層原則（對齊現有 ARS CLI）：
- 高階 workflow 優先，不暴露底層步驟給一般使用者
- `publish-youtube` 包住 package + upload，日常用這個
- `prepare-youtube` / export / render 只在除錯或補跑單一步驟時使用

---

## 3. Hooks 設計

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PLUGIN_ROOT\"/scripts/keyword-detector.mjs",
            "timeout": 3
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PLUGIN_ROOT\"/scripts/session-start.mjs",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PLUGIN_ROOT\"/scripts/review-intent-stop.mjs",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

| Hook | Script | 作用 |
|------|--------|------|
| `UserPromptSubmit` | `keyword-detector.mjs` | 偵測觸發詞（"scene plan", "寫稿", "review" 等）→ inject skill context |
| `SessionStart` | `session-start.mjs` | 檢查 `.ars/config.json` 存在 + provider 有效，等同輕量 `/ars:doctor` |
| `Stop` | `review-intent-stop.mjs` | 偵測 `.ars/review-intents/` 有未處理 intent → 注入提醒「執行 `/ars:scene-fix latest`」|

Hook 設計原則：**只做輕量 guardrail，不做 heavy automation**。不在 hook 裡自動修改檔案或觸發 LLM。

---

## 4. Public Interfaces

### 4.1 Provider Adapter Interfaces

ARS CE 的 LLM / TTS / publish 全部走 adapter，不綁死特定 provider。**必須在 Milestone 1 定義以下 TypeScript interface**，並附 reference implementation 與 no-op stub：

```typescript
// LLM adapter（用於 prepare-youtube 文案生成等）
interface ILLMAdapter {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  readonly providerId: string;
}

// TTS adapter（音訊生成）
interface ITTSAdapter {
  synthesize(text: string, options: TTSOptions): Promise<Buffer>;
  readonly providerId: string;
  readonly supportedVoices: string[];
}

// Publish adapter（YouTube 等平台）
interface IPublishAdapter {
  upload(artifact: PublishArtifact, options: PublishOptions): Promise<PublishResult>;
  readonly platformId: string;
}
```

Reference implementations 隨 starter repo 附：
- `MiniMaxTTSAdapter`（現有 stack）
- `AnthropicLLMAdapter`（現有 stack）
- `YouTubePublishAdapter`（現有 stack）
- `NoOpTTSAdapter` / `NoOpLLMAdapter`（讓新用戶可以 dry-run 完整流程）

### 4.2 Provider Config

`/ars:setup` 產生 `.ars/config.json`：

```json
{
  "llm": {
    "default": "anthropic",
    "fallbacks": ["openai"]
  },
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

預設：TTS `none`（可退化），social/analytics disabled（opt-in），review UI `slides`。

### 4.3 `scene-plan` Artifact

輸出到 `.ars/scene-plans/<series>/<epId>.json`：

```json
{
  "version": 1,
  "target": { "series": "ginseng-channel", "epId": "ep024" },
  "continuity": {
    "theme": "editorial-tech",
    "paletteMode": "series-default",
    "motionFamily": "clean-kinetic",
    "density": "medium",
    "forbiddenMoves": ["random-new-layout", "unsafe-text-overflow"]
  },
  "scenes": [
    {
      "stepId": "intro",
      "tier": "A",
      "goal": "hook",
      "cardFamily": "cover",
      "variant": "cover.editorial",
      "writeScope": "content-only",
      "reviewPriority": "high"
    }
  ]
}
```

**Tier 規則（V1 簡化版）**：

| Tier | 允許操作 | writeScope |
|------|---------|------------|
| `A` | 只改內容，card/variant locked | `content-only` |
| `B` | 可調 token / motion preset | `variant-flexible` |

> V1 不做 C tier（「複製 variant 生新 variant」）。tier 邊界靠 CLI schema validation 強制，不靠 prompt。

### 4.4 `review-intent` Inbox

寫入 `.ars/review-intents/<timestamp>-<stepId>.json`，gitignored：

```json
{
  "version": 1,
  "id": "20260415T140501Z-intro",
  "target": {
    "series": "ginseng-channel",
    "epId": "ep024",
    "stepId": "intro"
  },
  "source": {
    "ui": "slides",
    "hash": "#step=intro"
  },
  "feedback": {
    "kind": "visual",
    "message": "標題太擠，想改成更強的 opening image-led composition",
    "severity": "high"
  },
  "attachments": {
    "screenshotPath": "output/review/..."
  }
}
```

`/ars:scene-fix` 只讀 `target` + `feedback`，忽略 `source`（讓 slides 和 studio-exp 共用同一個 contract）。

---

## 5. Starter Repo

### 5.1 保留項目（從現有 ARS 萃出）

- Episode schema（`Episode`, `Step`, `CardContent` types）
- Remotion engine（`Composition.tsx`, `Root.tsx`, layouts, scenes）
- Card system（所有 Primary cards，移除私有頻道專用變體）
- CLI 高階命令（`publish youtube/social/all`, `prepare`, `export`, `render`）
- Slides preview
- Theme / ThemeContext 系統

### 5.2 移除項目

- 私有頻道人設與語音設定（ginseng-channel, lobster-daily-shorts 的具體設定）
- 私有 analytics playbook
- 私有 TTS 憑證耦合（改成 adapter interface）
- 直接耦合的 Threads/FB 發布細節（改成 extension）

### 5.3 新增 CLI namespace

```bash
npx ars setup                                   # 初始化（對應 /ars:setup）
npx ars doctor                                  # 健診（對應 /ars:doctor）
npx ars review open <series>/<epId>             # 開 slides review
npx ars review intent list|show|clear           # 管理 review-intent inbox
npx ars review intent create --from slides      # 手動建立 intent
npx ars scene plan <series>/<epId>              # 產生 scene-plan artifact
npx ars scene polish <series>/<epId>            # B tier scene refine
```

---

## 6. Review / Studio Plan

### 6.1 正式路徑：Slides Review（V1 交付）

在現有 slides preview 基礎上擴充：

- URL 支援 `?series=&ep=&step=` deep link
- 每個 step 固定 action bar：
  - `Mark for fix` → 寫入 `.ars/review-intents/`
  - `Copy /ars:scene-fix command`
  - `Capture screenshot` → 寫入 `attachments.screenshotPath`
- `/ars:scene-fix latest` 讀取後執行 targeted patch + validate + rerender preview

**Milestone 3 的具體 UI task**（不能只寫「slides review UI 完整可用」）：
1. `SlideApp` 加 action bar component（每個 step 右下角）
2. `Mark for fix` button → 呼叫 `npx ars review intent create --from slides`
3. Deep link 支援（`?step=<stepId>` 跳到指定 step）
4. Intent 寫入後顯示確認 toast

### 6.2 實驗路徑：Studio Spike（V1 non-blocking）

Timeboxed spike，不把 V1 成敗綁在上面。

驗收條件：
- 能定位目前 composition / step
- 能建立 step-level review intent（寫入同一個 inbox）
- 無法穩定取得 step context 時，自動 fallback 到 slides review

交付：若成功 → `npx ars review open --ui studio-exp`；若失敗 → 保留文件 + fallback，不阻塞 V1。

---

## 7. Delivery Plan

### Milestone 1：Extraction + Adapter

- [ ] 做 public/private split audit，列出每個 component 的歸屬
- [ ] 從現有 repo 萃出 starter repo 所需的公開 engine、schema、CLI、cards
- [ ] 清掉私有頻道內容、私有 prompts、私有資產耦合
- [ ] 定義並實作 `ILLMAdapter`, `ITTSAdapter`, `IPublishAdapter` TypeScript interface
- [ ] 附 reference implementation（Minimax/Anthropic/YouTube）+ no-op stub
- [ ] 新增 `npx ars setup` / `npx ars doctor`

### Milestone 2：Claude Code Plugin

- [ ] 建立 `plugin/hooks/hooks.json`（3 個 hooks）
- [ ] 建立 `plugin/scripts/`（keyword-detector, session-start, review-intent-stop）
- [ ] 建立 `plugin/agents/planner.md` + `publisher.md`
- [ ] 建立所有 `plugin/skills/*/SKILL.md`（10 個 skill）
- [ ] `/ars:setup`、`/ars:doctor`、`/ars:scene-plan`、`/ars:scene-fix`、`/ars:prepare-youtube`、`/ars:publish-youtube` 端對端跑通 starter repo

### Milestone 3：Review Loop

- [ ] Slides review URL deep link（`?step=<stepId>`）
- [ ] SlideApp action bar component（Mark for fix / Copy command / Screenshot）
- [ ] `npx ars review intent create --from slides` CLI
- [ ] `review-intent` file inbox contract 定案（schema version 1）
- [ ] `/ars:scene-fix latest` 只修單一 step，不碰 shared contracts
- [ ] `Stop` hook 偵測未處理 intent → 注入提醒

### Milestone 4：YouTube Core

- [ ] 保留現有兩段式 release（`prepare-youtube` → `publish-youtube`）
- [ ] Social / analytics 改成 extension packages，不進 core
- [ ] Dry-run + missing auth/metadata 的 guardrail 正確報錯

### Milestone 5：Studio Spike

- [ ] `studio-exp` feasibility spike（timeboxed）
- [ ] 成功 → 標 experimental，新增 `--ui studio-exp` flag
- [ ] 失敗 → 文件化 fallback，不延後 V1

---

## 8. Test Plan

### 全新使用者 onboarding
- Clone starter repo
- `/ars:setup` → `.ars/config.json` 正確建立
- `/ars:doctor` → 全部 check 通過
- 建立 demo episode，`npx ars episode validate` pass

### Authoring
- `/ars:episode-create` → 建立正確目錄結構
- `/ars:scene-plan` → 輸出 `.ars/scene-plans/*.json`，schema 合法
- `/ars:scene-build` → 只套用 plan 定義的變體，不自由發明
- `tsc --noEmit` / render / slides preview 不壞

### Review Loop
- Slides review：`Mark for fix` 寫入 `.ars/review-intents/`
- `Stop` hook：有未處理 intent 時注入提醒
- `/ars:scene-fix latest` 只修改目標 step
- 修完後 `episode validate` + slides preview 仍通過

### Release
- `/ars:prepare-youtube` → 產生候選稿，人工確認
- `/ars:publish-youtube --dry-run` → 本地 package 跑，upload dry-run
- 缺 auth 時報錯清楚

### Provider 退化
- TTS provider = `none` → 系統可退化，其他步驟不受影響
- Social extension disabled → core publish 不受影響

### Studio Spike（若 Milestone 5 成功）
- `studio-exp` 能建立 intent，或一鍵 fallback 到 slides

---

## 9. Assumptions

- ARS CE 是 **plugin + starter repo**，不是單一 npm 套件或 SaaS
- 開源版核心價值：**workflow + review loop + repeatable release path**
- Plugin 命名前綴：`/ars:xxx`，對齊 OMC 的 `/oh-my-claudecode:xxx`
- 正式可承諾的 review UI 是 Slides Review；Studio 在 V1 只承諾 feasibility spike
- YouTube 是 CE core 唯一內建發布目標；social/analytics 以 extension 提供
- TTS/LLM/Publish 走 adapter-first，附 reference implementation，不綁死 Minimax/Anthropic
- V1 `scene-plan` 只做 A/B tier（不做 C tier），tier 邊界靠 schema validation 強制
- Slides review action bar 是新功能，需要獨立 UI task，不能只說「完整可用」

---

## 10. Out of Scope (V1)

- SaaS / hosted version
- 多人協作（review intent 是 local file，不是共享 server）
- Custom card 開發 UI
- Scene-plan C tier（「複製 variant 生新 variant」）
- Analytics 進 core（extension only）
- Threads / FB 進 core（extension only）
