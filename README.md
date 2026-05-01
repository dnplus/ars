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
/ars:onboard          # 走一遍 demo、設定品牌
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
- **YouTube 上傳**：`ars auth youtube` 走 OAuth

兩個都不設也能跑 demo，只是不會有語音、不能上傳。

## 詳細文件

- [persona.md](./persona.md) — 這工具適不適合你
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 想送 PR 之前看一下
