# Creator Studio Spec

Date: 2026-04-18

## 1. 目標

### 1.1 起源：`/ars:plan` 跟 Claude Code 原生 plan mode 不對等

這份 spec 的最初動機不是「Studio 要取代 Claude Code」，而是 **plan 預覽體驗在自定義 slash command 下掉了一截**：

- Claude Code 原生 plan mode 有內建 plan preview UI，使用者可以在 TUI 裡看到完整 plan、再決定 approve
- 但 `/ars:plan` 是包進去的 slash command，沒辦法享有原生 plan mode 的 preview 介面
- 更糟的是，`/ars:plan` 會根據選的 mode（auto / acceptEdits 等）有時直接把 plan 寫進 `plan.md`，使用者得自己離開 TUI 去打開檔案才看得到結果——「寫了什麼」和「使用者看到什麼」之間有個尷尬的斷點

這不是 Claude Code 的鍋，是 ARS 包裝 slash command 後沒辦法繼承原生 plan UI 的副作用。要補回這個 preview 體驗，最乾淨的做法就是把 plan 預覽搬到 Studio——反正 Studio 本來就在跑、TUI ↔ Studio channel 也通了。

後來才順勢想到：既然 review 已經在 Studio、plan 又得搬進 Studio，那 build 中間的黑盒過場也應該補上。於是這份 spec 把三件事一起談。

### 1.2 目標範圍

升級後的責任分工：

- **TUI（Claude Code）仍是對話 / execution 主場**：產 artifact、改檔、跑 build / validate / audio / publish
- **Studio 是視覺檢查點**：補上 TUI 不擅長的長文閱讀、段落定位、即時預覽
- 兩者透過已有的 TUI ↔ Studio channel 互傳 intent / status

這份 spec 的重點不是做完全部階段，而是先把前半段最卡的 UX 解掉：

1. `plan` 內容在寫正式檔前要能在 Studio preview，並能指段落送 intent 回 TUI
2. `build` 要成為可觀察的過場，不是黑盒執行
3. `review` 要延續現有 Studio 優勢，但下沉成 shell 下的一個 phase

## 2. 現況摘要

### 2.1 現有 Studio 定位

- `npx ars review open <epId>` 會起 Vite Studio，並把 `series` / `ep` 帶進 query string
- `src/studio-main.tsx` 直接載入 `src/episodes/**/*.ts` 的 episode module
- `src/engine/studio/StudioApp.tsx` 的核心假設是：已經有可播放的 `episode`
- Studio 目前提供的是：
  - Remotion player
  - review intent submission
  - fix list
  - audio generate
  - step preview editor

也就是說，現在的 Studio 明確是 build 後的 review 面，不是 workflow shell。

### 2.2 現有 TUI ↔ Studio 通訊（已經通了）

這份 spec 不是從零做 IPC。Studio 與 TUI（Claude Code）之間已經有可用的 channel：

- **review intent**：Studio 端使用者選 step、輸入意見，送回 TUI 端由 Claude Code 處理
- **fix list / audio generate**：同一條 channel 雙向回送狀態與 artifact 變更通知

這個模型已經在 review phase 跑通，是這次升級可以直接複用的地基。Plan phase 的「指段落、送 intent」本質上就是 review intent 模型套到 markdown anchor 上，不需要另造一套協定。

### 2.3 現有 episode flow

- `episode create` 會先 scaffold 一個 placeholder `ep.ts`
- 下一步文字引導是先 `/ars:plan` 再 `/ars:build`
- 但 placeholder `ep.ts` 只是骨架，不適合拿來當 plan preview
- `review open` 要求的仍然是「已存在且可播放的 episode」

結果是：

- `plan` 階段在 Claude Code terminal 內進行
- 如果直接寫 `plan.md`，使用者在當下看不到舒服的 preview
- 如果直接進 `build`，使用者沒有一個視覺面可以先檢查 plan 寫了什麼
- `review` 雖然已有不錯 UI，但它出現得太晚

### 2.4 問題本質

目前的 friction 不是單一 command 設計錯，而是 ARS 包裝後丟掉了原生的視覺檢查點：

- `/ars:plan` 拿不到原生 plan mode 的 preview UI
- 寫進 `plan.md` 之後，使用者得自己離開 TUI 去看檔案
- Studio 只在 build 後才出現，前段（plan）跟中段（build）都沒有視覺面

## 3. 設計原則

### 3.1 Studio 補位，不取代 TUI

primary persona 是「會寫 code、熟 Claude Code 的 indie creator」，這群人在 terminal 裡本來就舒服。Studio 的角色是 **補上 ARS 包裝層拿不回來的原生體驗**（例如 `/ars:plan` 拿不到原生 plan preview、`plan.md` 寫完使用者要離開 TUI 才看得到），不是搶走對話主場。

判斷哪些事該搬到 Studio 的標準：

- ARS 包裝後流失的原生體驗（plan preview、artifact 寫入後的可見性）→ 搬到 Studio 補回來
- Claude Code 原生就做得好（對話、命令、log、錯誤處理）→ 留在 TUI，不重做

### 3.2 Claude Code 是執行主場

Claude Code 保留強項：

- 對話與意圖澄清
- 產出 artifact、改檔
- 跑 build / validate / audio / prepare / publish
- 根據 Studio intent 做後續執行

Studio 不嘗試在自己裡面複刻對話框——那只會做出難用版的 Claude Code。

### 3.3 複用既有 intent 模型，不為 plan 另造一套

Review phase 的「選 step → 輸入意見 → 送回 TUI」已經跑通。Plan phase 應該直接套用同一個模型，差別只在「選的東西」從 step 換成 markdown 段落（heading / 區塊 anchor）。這樣 Phase 2 不是新做一套 plan API，而是把 review intent 模型擴到 markdown anchor 上。

### 3.4 Phase-aware，不要求使用者理解 mode

使用者只需要理解「現在在哪個 workflow phase」：

- Plan
- Build
- Review
- Audio
- Prepare
- Publish

不需要理解：

- Claude Code native plan mode
- auto mode
- accept edits
- 哪個 slash command 先打比較對

### 3.5 檔案系統就是 source of truth，不做狀態機

Plan 不需要「draft vs approved」這種 git-like 狀態機。`.ars/episodes/<epId>/plan.md` 本身就是當前版本——它在 repo 裡、有 git 歷史、Claude Code 改它就是新版本。

Studio 要做的是：

- live render 當前的 `plan.md`（檔案變就重 render）
- 讓使用者指段落、輸入意見 → intent 送回 TUI → Claude Code 改檔 → Studio 自動更新

這樣 zero 狀態機，跟現有 review intent 的模型一致。`build` 直接吃 `plan.md`，不需要額外的 approve 動作（要 approve 就 git commit，本來就是這樣）。

### 3.6 單一 shell，分 phase 呈現

不要把 plan 硬塞進現有 review surface。

正確方向是：

- 同一個 Studio shell
- 不同 phase 有不同主畫面
- phase 間狀態連續、語意清楚

### 3.7 命名與 CLI 入口收斂

對外名稱維持「**Studio**」，但語意從「review 專用」擴成「episode workflow 的視覺檢查面」。

對內命名同步調整：

- `StudioApp`（現在預設是 review 介面） → 拆成 `StudioShell`（外層 phase routing）+ `ReviewView`（review phase 子畫面）
- 新增 `PlanView`、`BuildView` 對應其他 phase
- review intent → 泛化為 **`StudioIntent`**，欄位含 `anchorType: 'step' | 'card' | 'markdown-section'`，讓 plan / review / 未來 audio 共用同一條 channel
- 既有 `reviewIntent` API 留著當 alias，內部 forward 到 `StudioIntent` handler

CLI 入口收斂成兩個（加一個 alias）：

- `ars launch [--ep X]` — 主入口，TUI + Studio 同起，預設打開最近 episode
- `ars studio <epId> [--phase plan|build|review]` — 只開 Studio，給「已經在跑 TUI、想額外開視覺面」的場景用（含 dogfood 用法）
- `ars review open <epId>` — 保留為 deprecated alias，等於 `ars studio <epId> --phase review`

## 4. 目標體驗

### 4.1 產品定位

Studio 是 episode workflow 的 **視覺檢查面**：補上 ARS 包裝層拿不回來的原生 preview、把寫進檔案的 artifact 即時呈現出來。

TUI（Claude Code）仍然是對話與執行主場——使用者在 TUI 跑 `/ars:plan`、`/ars:build`，在 Studio 看結果與送 intent。

### 4.2 理想主流程

1. 使用者執行 `npx ars launch`，TUI + Studio 同時起來
2. 在 TUI 跑 `/ars:plan`，Claude Code 寫 / 改 `plan.md`
3. Studio 即時 render 當前 `plan.md`，使用者看得到「剛剛寫了什麼」
4. 在 Studio 指段落、輸入意見 → intent 送回 TUI → Claude Code 改檔
5. plan 滿意後在 TUI（或 Studio 一鍵）跑 `/ars:build`
6. Studio 顯示 build progress / 子狀態，不再黑盒
7. build 完成自動切到 `Review`
8. review intent 回送 TUI 做修正
9. 視需要進入 `Audio`、`Prepare`、`Publish`

一句話：

**TUI 負責「對話 + 執行」，Studio 負責「看見 + 指」**。兩邊透過已有的 channel 同步狀態。

## 5. Information Architecture

### 5.1 Shell 架構

Studio shell 需要升級成 phase-based app：

- `Episodes`
- `Plan`
- `Build`
- `Review`
- `Audio`
- `Prepare`
- `Publish`

其中第一階段先做：

- `Plan`
- `Build`
- `Review`

後面三個 phase 先保留 IA 與狀態欄位，不急著一次做完 UI。

### 5.2 建議路由

用同一個 Studio 入口，但讓 phase 明確存在：

- `/?series=<id>&ep=<id>&phase=plan`
- `/?series=<id>&ep=<id>&phase=build`
- `/?series=<id>&ep=<id>&phase=review`

這比維持 `review open` 單一路由更乾淨，因為：

- shell 能依 phase 決定主畫面
- query 可作為 CLI 與 Studio 溝通的最小共享狀態
- build 完成後可自然導向下一 phase

### 5.3 Shell 導覽元件

Studio shell 需要新增固定的 workflow rail：

- Episode title / series
- current phase
- phase status chips
- last updated / last action
- primary CTA

phase rail 應支援：

- 已完成
- 進行中
- blocked
- requires approval

## 6. Phase Spec

### 6.1 Plan

目標：

- 讓使用者看到當前 `plan.md` 的視覺化全貌
- 讓使用者可以「指著某段說這裡不對」，不必整段複製貼回 TUI

Plan phase 應顯示：

- live render of `.ars/episodes/<epId>/plan.md`（檔案變就重 render）
- structure outline / heading 導覽
- new card proposals 區塊（如果 plan 裡有）
- references / reminders
- 最近一次檔案變更的 diff highlight（讓使用者快速看到 Claude Code 改了哪）

Plan phase 的主要操作：

- 指段落 → 輸入 intent → 送回 TUI（複用 review intent channel）
- `Build now`（直接觸發 `/ars:build`，不需要額外 approve）

重要原則：

- `plan.md` 就是 source of truth，沒有 draft / approved 二分
- 「approve」這個動作本質上是 git commit，不在 Studio 裡發明新狀態
- Plan phase 的 intent 模型與 review intent **共用同一條 channel**，差別只在 anchor 從 step 換成 markdown heading / 區塊

### 6.2 Build

Build phase 不是空白 loading，而是 workflow interstitial。

應顯示：

- pipeline: `plan → build → review`
- current build step
- changed files
- validation status
- failure summary

建議的 build 子狀態：

- `materializing plan`
- `generating cards`
- `writing episode source`
- `validating episode`
- `ready for review`

視覺上可以做簡短過場，但重點是可理解，不是炫技。

### 6.3 Review

Review phase 直接沿用現有 `StudioApp` 的核心能力：

- player
- step navigation
- review intents
- fix list
- audio actions

但 Review 要成為 shell 下的一個 phase，而不是整個 Studio 的同義詞。

## 7. Claude Code 與 Studio 的責任分工

### 7.1 Studio 責任

- live render 當前 artifact（`plan.md`、episode source、render output）
- 提供「指段落 / 選 step → 輸入 intent」的視覺操作
- 呈現 build / review / audio 狀態
- 保留 workflow 上下文（series、ep、phase）

### 7.2 Claude Code 責任

- 對話、意圖澄清
- 跑 `/ars:plan` 寫 / 改 `plan.md`
- 跑 `/ars:build` 產 episode source / custom cards
- 執行 validation
- 根據 Studio 送來的 intent 修檔
- 跑 audio / prepare / publish

### 7.3 Interaction model

Studio 與 TUI 透過已有的 channel 雙向溝通。

Studio 送出的 intent（複用 review intent 模型，差別只在 anchor）：

- `plan` phase：anchor = markdown heading / 區塊，payload = 修改意見
- `review` phase：anchor = step / card，payload = 修改意見
- `build now` 之類的高階觸發

TUI 端（Claude Code）回送：

- 檔案變更通知（`plan.md` 寫了、episode source 變了）
- build 子狀態（materializing / generating / validating / done / failed）
- fix applied / audio generated

關鍵：**Studio 不在自己裡面做對話框**。要跟 LLM 對話就回 TUI 講，Studio 只負責「指 + 看」。

## 8. CLI 與入口設計

### 8.1 `ars launch`

`ars launch` 同時拉起 TUI（Claude Code）與 Studio，並把當前 episode context 帶入兩邊。

建議目標行為：

1. 起 Claude Code TUI（對話 / 命令主場）
2. 起 Studio（視覺檢查面）
3. 兩邊共享 series / ep / phase 狀態
4. 預設打開最近 episode 或 episode list

### 8.2 為什麼不分 Creator mode / Developer mode

primary persona 本來就會用 TUI，沒必要為了「假裝 Claude Code 不存在」做一個閹割版。先把「TUI + Studio 同起、責任分工清楚」這件事做好就夠了。等真的有非開發者使用者出現再考慮模式分叉。

### 8.3 `review open` 的定位

`ars launch` 是主要入口，`review open` 降為兼容快捷方式（直接跳到 review phase，給已經有 build 結果的 episode 用）。

## 9. Artifact Model

### 9.1 Plan artifacts

只有一種：`.ars/episodes/<epId>/plan.md` 本身。

- Studio 直接讀檔、live render
- Claude Code 寫檔（透過 `/ars:plan`）
- 版本歷史交給 git，不在 Studio 內發明 draft / approved 狀態

後續可選（真的需要再加）：

- 顯示最近一次 git diff highlight
- per-section anchor 持久化（讓 StudioIntent 能精準定位）

### 9.2 Build artifacts

Build phase 至少要暴露：

- build status
- changed files summary
- validation result
- next review target

### 9.3 Review artifacts

沿用現有：

- review intents
- fix-applied log
- audio-generate requests

## 10. 服務與 API 調整方向

### 10.1 Shell 層

需要一個新的 Studio shell component，負責：

- phase routing
- top-level navigation
- loading / error / empty states
- shared episode session state

現有 `StudioApp` 應下沉為 `ReviewPhaseView` 類型的內容區。

### 10.2 Plan phase API

不新發明 plan-only API，直接擴展現有的 review intent channel 成 `StudioIntent`：

- `GET /plan` — 回傳當前 `plan.md` 內容（含 heading anchor metadata）
- `WATCH /plan` — 檔案變動推播（讓 Studio live render）
- `POST /studio-intent` — 通用 intent，body 含 `anchorType: 'markdown-section' | 'step' | 'card'`、anchor id、payload

第一版不需要即時雙向編輯，「檔案 watch + 送 intent → Claude Code 改檔 → 檔案重 watch」這個 loop 就夠。

> 實作備註（v1）：client 端走 3s polling（`PlanView.tsx`），server 端每次 GET 重讀 `plan.md` 計算 heading anchor。`WATCH /plan` 推播留待通用檔案 watch infra 就緒再升級，不是 v1 blocker。

### 10.3 Build phase API

需要一個可輪詢或事件推送的 build job state：

- queued
- running
- failed
- done

同時要能帶：

- current step label
- short log summary
- validation status

**實作約束（v1）**：`/ars:build` 是 Claude Code skill、**不是 CLI command**（`cli/index.ts` 沒有 `build` 子命令）。因此 audio-generate 那種「Studio 主動 spawn 非互動式 CLI 子程序」的 job-state model 不適用。Build phase 拆成 **trigger** 與 **observe** 兩個端點：

```
POST /__ars/build-trigger
  body: { series, epId }
  行為: 呼叫 src/studio/studio-intents.ts::createStudioIntent() 寫一筆 StudioIntent
        ({ anchor: { type: 'episode', id: epId }, source: 'build',
           feedback: { kind: 'build-trigger', message: ... } })
        到 .ars/studio-intents/ — 由 TUI 側 /ars:apply-review 觀察並呼叫 /ars:build <epId>
  回傳: { ok, intentId, writtenAt }
  不 block；同一 epId 已有 pending build-trigger → 409

GET /__ars/build-status
  行為: stateless，每次呼叫即時讀檔派生狀態
  資料來源:
    - .ars/studio-intents/ 掃 pending `kind:'build-trigger'` → state='pending-trigger'
    - .ars/state/workstate.json 的 stage 欄位（building:<epId> / validating:<epId> / …）
      → state='in-progress' + stage
    - src/episodes/<series>/<epId>.ts 存在且 mtime > 最近 trigger → state='ready-for-review'
    - .ars/episodes/<epId>/last-build.json（若存在）→ validation summary
    - stage='failed:<epId>' → state='failed'
  回傳:
    {
      ok: true,
      build: {
        state: 'idle' | 'pending-trigger' | 'in-progress' | 'ready-for-review' | 'failed',
        stage?: string,
        pendingIntentId?: string,
        episodeSourcePath?: string,
        episodeSourceMtime?: string,
        lastBuildAt?: string,
        validation?: { ok: boolean, errorCount: number, summary: string },
      }
    }
```

配合需求：
- `/ars:build` skill 在開工 / validate / 完成 / 失敗時呼叫 `npx ars workstate set --stage ...` 讓 observe 端有資料
- `/ars:build` validate 完寫 `.ars/episodes/<epId>/last-build.json`
- `/ars:apply-review` 分支處理 `feedback.kind === 'build-trigger'` → 呼叫 `/ars:build <epId>`

### 10.4 Review phase 相容

現有 review-intent 重新命名 / 泛化為 `StudioIntent`（anchor 從 step 擴成 step / card / markdown-section）。fix-applied、audio-generate API 維持不變。

過渡期 review-intent 端點留著當 alias，內部 forward 到 `StudioIntent` handler，舊 client 不會壞。

## 11. 推薦 rollout

### Phase 1: Shell 化現有 Review Studio

- 引入 Studio shell
- 把現有 `StudioApp` 包成 `Review` phase
- 新增 phase rail 與 episode-level layout

### Phase 2: 引入 Plan phase

- live render `plan.md`，檔案變就重 render
- section-level intent（複用 review intent channel，anchor 換成 markdown heading）
- `Build now` 一鍵觸發，不做 draft/approved 狀態機
- 不急著做富編輯，preview + 指段落送 intent 就夠

### Phase 3: Build interstitial

- build status rail
- file / validation summary
- build 完自動切到 review

### Phase 4: `ars launch` 同起 TUI + Studio

- `ars launch` 同時拉起 TUI（Claude Code）與 Studio，並把當前 episode 帶入兩邊
- TUI 仍是對話 / 命令主場，Studio 是視覺檢查點
- 不是「Studio 取代 TUI」，是「兩邊一起準備好，使用者愛用哪邊用哪邊」
- `review open` 降為兼容快捷方式

### Phase 5: 後段 phase

- `Audio`
- `Prepare`
- `Publish`

## 12. 為什麼這樣排

### 12.1 先解最痛的斷點

目前最痛的是：

- plan 看不到舒服 preview
- build 是黑盒
- review 太晚才出現

Phase 1-3 正好直接打這三點。

### 12.2 不重做現有優勢

現有 Review Studio 已經有可用能力。

正確做法是把它放進更大的 workflow shell，而不是推倒重做。

### 12.3 適合 worktree 分支化實作

這套切法天然可拆：

- shell / routing
- plan phase
- build state
- launch integration

分支與 PR 邊界都清楚。

## 13. 主要風險

### 13.1 Studio 與 Claude Code session 同步

如果 TUI 那邊的狀態變了 Studio 沒同步到（或反過來），Studio 會變成漂亮但不可靠的鏡像。

所以第一版要刻意避免過度即時與雙向同步，先走「檔案 watch + 明確 intent → status」的模型——以檔案系統當共享狀態最穩。

### 13.2 Plan phase 過早追求富編輯

如果一開始就想做完整 document editor，範圍會爆。

第一版應先做：

- live render `plan.md`
- heading-level 段落定位
- 送 StudioIntent 回 TUI

而不是完整 Notion-like 編修器。

### 13.3 入口混亂

如果 `launch`、`review open`、未來 `studio open` 並存但語意不清，使用者反而更亂。

所以之後要明確收斂：

- 主要入口只有一個
- 其他命令是相容或除錯用途

## 14. 成功標準

完成第一輪後，應達成：

1. `ars launch` 同起 TUI + Studio，episode context 兩邊同步
2. `/ars:plan` 寫 `plan.md` 後，使用者不必離開 TUI 也看得到結果（Studio 即時 render）
3. 使用者可以在 Studio 指段落送 StudioIntent，Claude Code 收到後改檔
4. build 過程可在 Studio 內觀察，不再是黑盒
5. build 完成後自動銜接到 review
6. 現有 review 流程透過 StudioIntent 泛化後仍可運作，audio 流程不被破壞

## 15. 建議的第一個 implementation slice

如果要開 worktree 開始做，我建議第一刀是：

- 新增 Studio shell
- 保留現有 Review phase
- 先做一個只讀的 Plan phase placeholder
- phase route 先通

原因是這一刀能最快驗證最重要的產品方向：

- Studio 能不能撐住「視覺檢查面」這個新定位
- Review 是否能自然下沉成一個 phase
- 之後 Plan / Build 是否有乾淨掛點

這比一開始就做 plan apply workflow 更穩。

## 16. Migration Notes（Phase 1 落地時回頭 sync）

> ✓ **Phase 1 已 land**（2026-04-18）：`StudioShell` / `StudioIntent` / `ars launch` / `ars studio` 皆已在 main，`ars review` 降級為 deprecation shim（僅 `review close` 仍走 CLI 原生）。本節列的 skill text sync（`onboard` L65/L76、`audio` L51、`review` 通篇）也已在 Phase 1 commits 內完成。以下內容保留為 migration 歷史紀錄，供未來回顧當時的決策脈絡。

這份 spec 是設計方向，現有 skill / CLI 描述的是「現在跑得起來的事實」。在 Phase 1（StudioShell 拆分 + `StudioIntent` 泛化）真的 land **之前**，下面這些檔案維持現狀；land **之後**才回頭一次 sync：

### 文字 sync（Phase 1 完成後）

- `plugin/skills/onboard/SKILL.md`
  - L62-65：`npx ars review open ep-demo` 改成 `npx ars launch --ep ep-demo` 或 `npx ars studio ep-demo --phase review`，視最終 CLI 設計而定
  - L76：`pkill -f "ars review open"` 同步換掉
  - L178：`Review Studio` 字樣改成 `Studio`（拆掉 review-only 假設）
- `plugin/skills/audio/SKILL.md`
  - L9, L48-53：「the studio」措詞檢查一遍，確認指的是 review phase 而非整個 Studio
  - L51：`npx ars review open <epId>` 同 onboard 一起換
- `plugin/skills/review/SKILL.md`
  - L11, L47, L53：`npx ars review open` 換新入口
  - 通篇：考慮是否把 `review intent` → `StudioIntent (review anchor)`，或維持 review intent 當 user-facing 詞、StudioIntent 是內部實作
- `plugin/skills/apply-review/SKILL.md`
  - 確認 `.ars/review-intents/` 檔案契約是否仍然是 source of truth，或要改走 `.ars/studio-intents/`
- `README.md`
  - 目前沒有 Studio 相關描述，加新章節時直接用新術語即可

### 程式碼 sync（Phase 1 同 PR 或緊接著）

- `src/engine/studio/StudioApp.tsx` → 拆成 `StudioShell` + `ReviewView`
- `src/studio-main.tsx` → 改成依 `?phase=` 掛載對應 view
- `cli/commands/review.ts` → `review open` 加 deprecation warning，內部 forward 到新入口
- `cli/index.ts` → 註冊 `ars launch` 與 `ars studio` 子命令
- `plugin/scripts/review-intent-stop.mjs` 與相關 channel handler → 評估是否同步泛化為 `studio-intent`，或維持檔名、內部 schema 加 `anchorType`

### 不動的東西（即使 Phase 1 land 也維持）

- `.ars/review-intents/` 檔案目錄與 schema：除非真的有實質 anchor 擴充需求，否則維持檔名穩定，避免破壞既有 watcher
- `_session-end.flag` 機制：Vite Studio plugin 寫的，跟 phase 無關，繼續用
- audio / pronunciation_dict.yaml flow：Phase 1 不碰

### 觸發條件

只在以下兩件事**都**發生後才執行這份 sync：

1. `StudioShell` + `PlanView` placeholder 已 merge 到 main
2. `ars launch` 或 `ars studio <epId> --phase ...` 至少一個入口可用

在這之前提早改 skill 文件會讓 onboarding 講出 user 跑不出來的指令。
