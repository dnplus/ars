# ARS CE Extraction Audit

根據 `ARS-CE-PRD.md` 4.1 adapter 規範與 5.2 移除項目，ARS CE starter repo 的上游元件歸屬如下。

| Upstream path | Decision | Notes |
| --- | --- | --- |
| `src/engine/` | keep | 完整保留公開 Remotion engine、layouts、cards、slides preview 基礎設施。 |
| `src/Root.tsx` | keep | 保留 Remotion compositions 註冊入口。 |
| `src/index.ts` | keep | Remotion bundle 入口，Root 需要。 |
| `src/index.css` | keep | Root 與 slides 共享樣式。 |
| `src/slides-main.tsx` | keep | `vite.slides.config.ts` 需要的 slides entry。 |
| `src/slides.html` | keep | slides preview HTML entry。 |
| `src/global.d.ts` | keep | `require.context` 與 Vite 全域型別宣告。 |
| `src/episodes/template/` | keep | 公開 starter series，作為 `init` 與 demo 的唯一內建範本。 |
| `public/shared/` | keep | 公開 fonts 與共用素材。 |
| `public/episodes/template/` | keep | template series 對應素材。 |
| `cli/commands/episode.ts` | keep | 核心 episode create/list/validate/stats。 |
| `cli/commands/init.ts` | keep | 以 template series 初始化新 series。 |
| `cli/commands/slides.ts` | keep | 啟動公開 slides review UI。 |
| `cli/commands/studio.ts` | keep | Remotion studio 啟動入口。 |
| `cli/commands/export.ts` | keep | cover / srt export 屬核心能力。 |
| `cli/commands/prepare.ts` | keep | 核心 prepare flow 保留，後續逐步切換到 adapter。 |
| `cli/commands/publish.ts` | keep | 高階 publish orchestration 保留。 |
| `cli/commands/upload.ts` | refactor | YouTube upload 可保留；Threads / FB 細節需後續抽成 extension。 |
| `cli/commands/audio.ts` | refactor | MiniMax 直接耦合改萃取到 `MiniMaxTTSAdapter`，command 本身保留。 |
| `cli/commands/pipeline.ts` | refactor | 先保留 orchestration；social steps 後續移到 extension。 |
| `cli/commands/analytics.ts` | remove | PRD 5.2 指定移除私有 analytics playbook，不進 core。 |
| `cli/lib/llm-cli.ts` | refactor | 萃取成 `AnthropicLLMAdapter` reference implementation。 |
| `cli/lib/youtube-upload.ts` | refactor | 萃取成 `YouTubePublishAdapter` reference implementation。 |
| `cli/lib/youtube-client.ts` | keep | 公開 YouTube OAuth 與 upload 基礎 client。 |
| `cli/lib/threads-client.ts` | remove | PRD 5.2 指定直接耦合 social publish 細節移到 extension。 |
| `src/episodes/ginseng-channel/` | remove | 私有頻道人設與內容。 |
| `src/episodes/ginseng-shorts/` | remove | 私有短影音內容與素材依賴。 |
| `src/episodes/lobster-daily-shorts/` | remove | 私有頻道內容。 |
| `src/episodes/gss/` | remove | 客戶端私有 series。 |
| `public/episodes/ginseng-channel/` | remove | 私有素材。 |
| `public/episodes/ginseng-shorts/` | remove | 私有素材。 |
| `public/episodes/lobster-daily-shorts/` | remove | 私有素材。 |
| `public/episodes/gss/` | remove | 私有素材。 |
| `skills/ginseng-channel/` | remove | 私有 skill / prompts。 |
| `.env` | remove | 不進公開 repo；改提供 `.env.example`。 |
| `package.json` scripts / metadata | refactor | 移除私有頻道與不存在 config 的 scripts，保留核心依賴與 `ars` bin。 |

## Adapter requirements

公開版在 `src/adapters/` 定義三個 provider interface：

- `ILLMAdapter`
- `ITTSAdapter`
- `IPublishAdapter`

Starter repo 內附 reference implementation：

- `AnthropicLLMAdapter`
- `MiniMaxTTSAdapter`
- `YouTubePublishAdapter`
- `NoOpLLMAdapter`
- `NoOpTTSAdapter`

這些 adapter 先作為公開基礎設施存在，後續 CLI flow 會逐步改成 adapter-first。
