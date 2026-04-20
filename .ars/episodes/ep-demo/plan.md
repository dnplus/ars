# ep-demo — ARS Studio Walkthrough

> Stub plan for showcasing the new Studio UI. 不會 commit，純測試用。

---

## Topic

**ARS Studio 新介面走過一遍**：Plan → Build & Review 按鈕 → 過場動畫 → Review 視窗 → 留言/定點註解 → 送審回 Plan。

這集的目標是把 2026-04 的 Studio 改版 demo 給一個第一次看的使用者。

---

## Structure

1. **Intro** — 「人蔘 Try Catch」片頭，30 秒內交代這集在幹嘛
2. **ARS Overview** — 一張圖講清楚 ARS 的 Plan / Build / Review 三段式
3. **Walkthrough** — 實際走一遍流程，每個按鈕按在哪裡、按下去會發生什麼
4. **Customize** — 簡單帶一下 series-config.ts 可以改什麼
5. **Verify** — 測試怎麼跑（`npm run lint`、dev:studio、validate）
6. **Episode** — 一個實際 episode 從 plan.md 到 render 的時間線
7. **Analytics** — 產出後看什麼指標（render time / card count / narration 長度）
8. **Review Studio UI** — 本集重點：新的 pin / status bar / 送審流程
9. **Ending** — Sign-off，「人蔘好難，但 Catch 住就對了」

---

## New cards

這集會用到的卡片類型：

- `cover` — 片頭
- `markdown` — 大部分敘述
- `image` — ARS 架構圖、Studio 截圖
- `summary` — 收尾

---

## References

- `src/engine/studio/StudioShell.tsx` — 新的 shell，只剩 plan / review 兩個 tab
- `src/engine/studio/components/BuildOverlay.tsx` — 全螢幕過場動畫
- `src/engine/studio/components/PinLayer.tsx` — 定點註解
- `creator-studio.md` — 為什麼需要 Studio

---

## Reminders

- **不要** 在 overlay 動畫裡放實際 render 的 log（那是 TUI 端的事）
- StatusBar 只顯示 UI 狀態，不是 Claude Code 的內部進度
- 送審按鈕只是 UI 動作，實際 apply 還是 TUI 端跑 `/ars:apply-review`

**大概就是這樣。**
