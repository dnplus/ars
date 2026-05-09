# ARS

把筆記變成 YouTube 影片的 Claude Code 工作流。基於 Remotion 渲染。

## 跑起來

需要 Node 22.12+ 跟 Claude Code CLI。

```bash
# 1. 裝 ARS
git clone https://github.com/dnplus/ars.git
cd ars && npm install && npm link

# 2. 開一個放系列的資料夾
mkdir my-series && cd my-series

# 3. 初始化（會問 TTS、YouTube、頻道名、版型）
ars init my-series

# 4. 進 Claude Code
ars
```

進去之後在 Claude Code 裡跑：

```text
/ars:onboard          # 開啟 ep-demo 模板預覽，用 Studio 留言設定系列風格
/ars:plan ep001       # 規劃第一集
/ars:build ep001      # 產生影片
/ars:review ep001     # 開 Studio 審稿
/ars:prepare-youtube ep001
/ars:publish-youtube ep001
```

## 出問題時

```bash
ars doctor            # 檢查環境、credentials、檔案結構
```

## 可選 credentials

- **MiniMax TTS**：`MINIMAX_API_KEY`、`MINIMAX_GROUP_ID` 寫進 `.env`
- **VoxCPM TTS**（自架，Apache-2.0）：自己跑一個 OpenAI 相容 server（例：`vllm serve openbmb/VoxCPM2 --omni --port 8000`），把 `VOXCPM_API_BASE` 寫進 `.env`。沒有 native subtitle timing，要在 `series-config.ts` 把 `reviewRequiresNativeTiming` 設成 `false`
- **YouTube 上傳**：`ars auth youtube` 走 OAuth

兩個都不設也能跑 demo，只是不會有語音、不能上傳。

## Onboard 怎麼看

`/ars:onboard` 會把 `ep-demo` 當成預設模板展示頁面打開。先瀏覽每種卡片，看到不符合系列風格的地方，就在 Studio 下方留言或選取畫面元件留言。

Onboard customize 階段的留言預設會變成系列模板修改，例如 `series-config.ts`、`SERIES_GUIDE.md`、共用素材，或 `src/episodes/<series>/cards/` 裡的系列卡片 override。只有臨時修展示頁時，才在留言裡說「只改這一頁」。

## 詳細文件

- [persona.md](./persona.md) — 這工具適不適合你
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 想送 PR 之前看一下
