# ARS CE PRD — Agentic Remotion Studio Community Edition

**Version**: 0.1 (Draft)
**Status**: Pre-implementation

---

## 1. Summary

Agentic Remotion Studio（ARS）定位為 **Claude Code plugin + 全域 CLI 工具** 的雙件式開源產品，採用 OMC-style 安裝模型。

- **Plugin**（`/ars:xxx`）：workflow UX 層，負責場景規劃、review 回送、發布指令、setup/doctor
- **全域 CLI（`ars`）**：execution layer。在使用者自己的頻道 repo 執行 `ars setup`，把 engine（`src/engine/`）、`plugin/skills` 註冊、`.ars/config.json`、CLAUDE.md patch 安裝到該 repo。使用者後續用 `ars update` 同步新版 engine。

ARS 這個 repo 同時是：(1) 開發環境（維護者 clone 下來改 engine / skill），(2) 發佈內容（被全域安裝後複製到使用者的頻道 repo）。這跟 OMC 的模式一致 —— 不是 starter repo，也不是 npm lib。

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
├── src/                           # Remotion engine（會被 ars setup 複製到使用者 repo）
├── cli/                           # ARS 全域 CLI 入口（bin: ars）
├── public/                        # 靜態資產
├── skills/                        # 知識 skills（非 plugin slash commands）
│   ├── agentic-remotion-studio/   # ARS 本身的 SKILL.md 與 references
│   └── ...
└── ...
```

### 2.2 安裝方式

```bash
# 1. 裝 Claude Code plugin（提供 /ars:xxx slash commands + hooks）
/plugin marketplace add https://github.com/<org>/agentic-remotion-studio
/plugin install agentic-remotion-studio

# 2. 裝全域 CLI
npm i -g agentic-remotion-studio

# 3. 在自己的頻道 repo 執行初始化
cd <my-channel-repo>
ars setup            # 等同 /ars:setup
```

`ars setup` 行為（Route A：複製 engine）：
- 複製 `src/engine/` 到使用者 repo 的 `src/engine/`（使用者可版本控管、修改）
- 建立 `.ars/config.json`、`src/episodes/template/`（示範）
- Patch `CLAUDE.md`：加入 ARS 使用提示（類似 OMC `omc setup` 的 marker 區塊）
- 註冊 plugin skills 到專案 `.claude/` 或 user scope
- 後續使用 `ars update` 重新複製最新版 engine（backup 舊版到 `.ars/backups/<timestamp>/`），非三方合併

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
| `publisher` | sonnet | prepare → 人工確認 → publish，wraps `ars` CLI | 不能自行修改 episode 內容 |

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

ARS CE 的 LLM 推論**全部由 Claude Code 自己跑**：skill 被觸發時 Claude Code 會讀 `SKILL.md` 指示並在當前對話 context 直接執行（寫稿、scene-plan、prepare-youtube 等）。CLI 本身不呼叫任何 LLM API，`.ars/config.json` 也沒有 `llm` 欄位。這讓使用者不用另外準備 LLM 金鑰，只要裝好 Claude Code 就能完整跑流程。

需要外部 provider 的只剩 **TTS 與 Publish 兩類 I/O**，走 adapter interface 不綁死特定 provider。**必須在 Milestone 1 定義以下 TypeScript interface**，並附 reference implementation 與 no-op stub：

```typescript
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

Reference implementations 隨 engine 一起複製到使用者 repo：
- `MiniMaxTTSAdapter`（現有 stack）
- `YouTubePublishAdapter`（現有 stack）
- `NoOpTTSAdapter`（讓新用戶可以 dry-run 完整流程，TTS 關閉時自動 fallback）

### 4.2 Provider Config

`/ars:setup` 產生 `.ars/config.json`：

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

預設：TTS `none`（可退化），social/analytics disabled（opt-in），review UI `slides`。LLM 推論不在 config 裡 —— 由 Claude Code 本身負責，沒有需要切換的 provider。

### 4.3 `scene-plan` Artifact

輸出到 `.ars/scene-plans/<series>/<epId>.json`：

```json
{
  "version": 1,
  "target": { "series": "template", "epId": "ep-demo" },
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
    "series": "template",
    "epId": "ep-demo",
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

## 5. Engine & Target Repo

### 5.1 Engine 內容（`ars setup` 會複製到使用者 repo 的 `src/engine/`）

- Episode schema（`Episode`, `Step`, `CardContent` types）
- Remotion engine（`Composition.tsx`, `Root.tsx`, layouts, scenes）
- Card system（CardSpec primitives：`BaseSlide` / `WindowSlide` / `ScrollSlide`，通用 cards：cover / code / image / markdown，auto-register via `import.meta.glob`）
- Slides preview
- Theme / ThemeContext 系統（`ThemeSeed → deriveTheme()` 純函式）

### 5.2 移除項目

- 私有頻道人設與語音設定（上游私有頻道的具體設定）
- 私有 analytics playbook
- 私有 TTS 憑證耦合（改成 adapter interface）
- 直接耦合的 Threads/FB 發布細節（改成 extension，V1 不交付）
- LLM adapter 層（改由 Claude Code 自己做推論）

### 5.3 CLI namespace（全域 `ars` 指令）

```bash
ars setup                                   # 初始化：複製 engine、建立 .ars/、patch CLAUDE.md
ars update                                  # 重新複製最新 engine（舊版 backup 到 .ars/backups/）
ars doctor                                  # 健診：檢查 engine 版本、provider env、config schema
ars review open <series>/<epId>             # 開 slides review
ars review intent list|show|clear           # 管理 review-intent inbox
ars review intent create --from slides      # 手動建立 intent
ars scene plan <series>/<epId>              # 產生 scene-plan artifact
ars scene polish <series>/<epId>            # B tier scene refine
```

CLI 原則對齊 OMC：CLI 只做**確定性、冪等的 I/O**（檔案複製、schema validate、TTS 呼叫、YouTube upload），不呼叫 LLM。Skill 才是 LLM-driven workflow，把 CLI 當手腳使用。

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
2. `Mark for fix` button → 呼叫 `ars review intent create --from slides`
3. Deep link 支援（`?step=<stepId>` 跳到指定 step）
4. Intent 寫入後顯示確認 toast

### 6.2 實驗路徑：Studio Spike（V1 non-blocking）

Timeboxed spike，不把 V1 成敗綁在上面。

驗收條件：
- 能定位目前 composition / step
- 能建立 step-level review intent（寫入同一個 inbox）
- 無法穩定取得 step context 時，自動 fallback 到 slides review

交付：若成功 → `ars review open --ui studio-exp`；若失敗 → 保留文件 + fallback，不阻塞 V1。

---

## 7. Delivery Plan

### Milestone 1：Extraction + Global-Tool 模型

- [x] 做 public/private split audit，列出每個 component 的歸屬
- [x] 從上游私有 repo 萃出公開 engine、schema、CLI、cards（現 ARS CE repo）
- [x] 清掉私有頻道內容、私有 prompts、私有資產耦合
- [ ] 定義並實作 `ITTSAdapter`, `IPublishAdapter` TypeScript interface（LLM 走 Claude Code，不做 adapter）
- [ ] 附 reference implementation（Minimax TTS / YouTube Publish）+ `NoOpTTSAdapter` stub
- [ ] 實作 `ars setup` 新行為：複製 `src/engine/` 到 target repo、建立 `.ars/config.json`、patch `CLAUDE.md`、註冊 plugin skills
- [ ] 實作 `ars update`：重新複製 engine，舊版 backup 到 `.ars/backups/<timestamp>/`
- [ ] 更新 `ars doctor`：檢查 engine 版本、config schema、TTS/Publish provider env

### Milestone 2：Claude Code Plugin

- [ ] 建立 `plugin/hooks/hooks.json`（3 個 hooks）
- [ ] 建立 `plugin/scripts/`（keyword-detector, session-start, review-intent-stop）
- [ ] 建立 `plugin/agents/planner.md` + `publisher.md`
- [ ] 建立所有 `plugin/skills/*/SKILL.md`（10 個 skill）
- [ ] `/ars:setup`、`/ars:doctor`、`/ars:scene-plan`、`/ars:scene-fix`、`/ars:prepare-youtube`、`/ars:publish-youtube` 在 `ars setup` 初始化過的空白 repo 端對端跑通

### Milestone 3：Review Loop

- [ ] Slides review URL deep link（`?step=<stepId>`）
- [ ] SlideApp action bar component（Mark for fix / Copy command / Screenshot）
- [ ] `ars review intent create --from slides` CLI
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
- `npm i -g agentic-remotion-studio` + 裝 Claude Code plugin
- 在空的頻道 repo 跑 `ars setup` → 複製 `src/engine/`、建立 `.ars/config.json`、patch `CLAUDE.md`
- `/ars:doctor` → 全部 check 通過（engine 版本、provider env、config schema）
- 建立 demo episode，`ars episode validate` pass
- 升級流程：`ars update` → 新 engine 覆寫，舊版存在 `.ars/backups/`

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

- ARS CE 是 **Claude Code plugin + 全域 CLI 工具**（OMC-style），`ars setup` 把 engine 複製到使用者自己的頻道 repo
- 開源版核心價值：**workflow + review loop + repeatable release path**
- Plugin 命名前綴：`/ars:xxx`，對齊 OMC 的 `/oh-my-claudecode:xxx`
- 正式可承諾的 review UI 是 Slides Review；Studio 在 V1 只承諾 feasibility spike
- YouTube 是 CE core 唯一內建發布目標；social/analytics 以 extension 提供
- LLM 推論由 Claude Code 本身執行（skill-driven），CLI 不呼叫 LLM API、config 沒有 LLM 欄位
- TTS/Publish 走 adapter-first，附 reference implementation，不綁死 Minimax/YouTube
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
