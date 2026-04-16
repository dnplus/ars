# ARS CLI Improvement Spec

Date: 2026-04-15

> Update (2026-04-16): this spec predates the current naming. The public CLI first-run entrypoint is now `npx ars init <series>`, the guided skill entrypoint is `/ars:onboard`, and package `postinstall` only syncs plugin assets instead of bootstrapping a repo.

## 1. 目標

把 `ars` 從目前的「手寫 dispatcher + 局部 setup/update/doctor」升級成可直接啟動 Claude、可在 `npm install` 後自動完成靜默初始化、具備版本追蹤與防降級、並有可重跑的 e2e 驗證的完整 CLI。

本 spec 以 `/tmp/omc-ref` 的下列設計為對標：

- `src/cli/index.ts`：root action / hidden postinstall / subcommand lifecycle
- `src/cli/launch.ts` + `src/cli/tmux-utils.ts`：bare CLI 直接進 Claude、tmux policy、exit code propagation
- `src/features/auto-update.ts` + `src/installer/index.ts`：`.omc-version.json`、compareVersions、downgrade guard
- `src/__tests__/*` + `src/cli/__tests__/*`：CLI boot / launch / version / installer regression tests

## 2. 現況摘要

### 2.1 現有 ARS CLI 架構

- `cli/index.ts` 用手寫 token parser 決定第一個 token 是否是 subcommand，再動態 `import('./commands/*')`
- 所有 command 以 `run(args: string[])` 形式存在，沒有統一的 option parser
- `setup` / `update` / `doctor` 主要邏輯分散在：
  - `cli/commands/setup.ts`
  - `cli/commands/update.ts`
  - `cli/commands/doctor.ts`
  - `cli/lib/install.ts`
  - `cli/lib/ars-config.ts`
- plugin 資產存在 `plugin/`，但 `ars` 本身沒有「直接起 Claude 並掛上 plugin」的 launch layer
- 版本 metadata 只有 `.ars/engine-version.json`，內容只記錄 `commit / copiedAt / source`
- `package.json` 沒有 `postinstall` script
- repo 目前沒有 CLI 單元測試與 e2e 測試基礎

### 2.2 已確認的現有問題

- `npx ars` 無 subcommand 時只顯示 help，不會進 Claude
- `npx ars setup --help` / `update --help` 會被 root parser 攔截，輸出的是整份 top-level help
- `plugin/scripts/session-start.mjs` 需要 `llm.default`，但 `cli/lib/ars-config.ts` 的 `ArsConfig` 沒有 `llm`
- `.ars/config.json` 實際內容與 `ArsConfig` 型別已經漂移，doctor 目前只是剛好沒有檢查到 `llm`
- `.ars/engine-version.json` 無法支援 CLI 版本比對、防降級、drift 檢查
- `setup` / `update` 只做到 copy engine，沒有完整 force option family、也沒有深度 doctor checks
- package metadata 與 install/runtime package lookup 需要保持一致，避免安裝/定位 drift

## 3. 目標架構

ARS CLI 改成四層：

1. Bootstrap layer
- `cli/index.ts`
- 使用 Commander 建立 root program、`--help` / `--version`、default action、hidden `postinstall`

2. Launch layer
- `cli/commands/launch.ts`
- `cli/lib/tmux.ts`
- 負責 bare `ars` 啟動 Claude、tmux policy、flag normalize、plugin-dir 注入、exit code propagation

3. Install/version layer
- `cli/lib/install.ts`
- `cli/lib/version.ts`
- `cli/lib/runtime-package.ts`
- 負責 target root 判定、engine/plugin sync、`.ars/.ars-version.json`、防降級

4. Doctor/test layer
- `cli/commands/doctor.ts`
- `cli/lib/doctor/*.ts`
- `cli/__tests__/*`
- `tests/e2e/*`
- 負責深度檢查、JSON output、CLI regression、乾淨目錄安裝驗證

## 4. 功能 Spec

### 4.1 Bare `ars` 直接啟動 Claude

#### 目標行為

- `ars` 無 subcommand 時，直接等價於「啟動 Claude CLI + 載入 ARS plugin」
- `ars launch` 是顯式別名，與 bare `ars` 行為一致
- `ars --help` 與 `ars --version` 保留給 ARS CLI 本身
- `ars <unknown option passthrough>` 視為 Claude launch args，不報 unknown command
- `--print` / `-p` 時禁止 tmux 包裝，直接 `execFileSync('claude', ...)`
- 在 tmux 內執行時，直接在當前 pane 啟動 Claude
- 不在 tmux 內但系統有 tmux 時，自動開新 session + attach
- tmux 不可用或 attach 失敗時，fallback 到 direct launch
- Claude exit code 必須原樣傳回 ARS process

#### 需要修改 / 新增的檔案

- 修改 `cli/index.ts`
- 新增 `cli/commands/launch.ts`
- 新增 `cli/lib/tmux.ts`
- 新增 `cli/lib/runtime-package.ts`
- 新增 `cli/__tests__/cli-boot.test.ts`
- 新增 `cli/__tests__/launch.test.ts`
- 新增 `cli/__tests__/tmux-utils.test.ts`

#### 具體 API

```ts
// cli/lib/runtime-package.ts
export interface RuntimePackageInfo {
  name: string;
  version: string;
  packageRoot: string;
  pluginRoot: string;
}

export function getRuntimePackageInfo(importMetaUrl: string): RuntimePackageInfo;

// cli/lib/tmux.ts
export type ClaudeLaunchPolicy = 'inside-tmux' | 'outside-tmux' | 'direct';

export function resolveLaunchPolicy(
  env?: NodeJS.ProcessEnv,
  args?: string[],
): ClaudeLaunchPolicy;

export function isTmuxAvailable(): boolean;
export function buildTmuxSessionName(cwd: string): string;
export function buildTmuxShellCommand(bin: string, args: string[]): string;
export function wrapWithLoginShell(command: string): string;
export function tmuxExec(args: string[]): string;

// cli/commands/launch.ts
export function normalizeClaudeLaunchArgs(args: string[]): string[];
export function isPrintMode(args: string[]): boolean;
export function runClaude(cwd: string, args: string[]): void;
export async function launchCommand(rawArgs: string[]): Promise<void>;
```

#### 設計重點

- `launchCommand()` 會把 `--plugin-dir <runtimePluginRoot>` 注入 Claude args，確保 `/ars:*` 可直接用
- `normalizeClaudeLaunchArgs()` 至少處理：
  - plugin-dir 注入
  - `--print` / `-p` 保留
  - ARS 自己保留的 flag 不可泄漏到 subcommand mode
- root dispatch 規則：
  - 第一優先：`--help` / `--version`
  - 第二優先：已知 subcommand
  - 第三優先：其餘全部視為 launch passthrough

#### 驗收條件

- `npx ars` 會進 launch path，不再只是印 help
- `npx ars --model sonnet` 能把 `--model sonnet` 原樣傳給 Claude
- `npx ars setup --help` 顯示 setup 自己的 help，不是 root help
- `npx ars --print "hello"` 不使用 tmux

### 4.2 Postinstall 自動靜默 setup

#### 目標行為

- 在乾淨專案跑 `npm install <ars-package>` 後，自動靜默執行 setup
- setup target 必須是 consumer project root，不是 `node_modules/<ars-package>`
- global install 或 ARS 自己 repo 開發環境要自動 skip
- postinstall 失敗預設不讓 `npm install` fail，但要輸出可診斷 warning

#### 需要修改 / 新增的檔案

- 修改 `package.json`
- 修改 `cli/index.ts`
- 新增 `cli/commands/postinstall.ts`
- 修改 `cli/lib/install.ts`
- 新增 `cli/__tests__/postinstall.test.ts`

#### 具體 API

```ts
// cli/lib/install.ts
export function resolveSetupTargetRoot(env: NodeJS.ProcessEnv, packageRoot: string): string | null;

// cli/commands/postinstall.ts
export interface PostinstallResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
}

export async function postinstallCommand(): Promise<PostinstallResult>;
```

#### package.json 調整

```json
{
  "scripts": {
    "postinstall": "node --import tsx ./cli/index.ts postinstall"
  }
}
```

#### 設計重點

- `resolveSetupTargetRoot()` 優先使用 `INIT_CWD`
- 若 `INIT_CWD` 缺失、等於 package root、或落在 `node_modules` 內，則 skip
- 若 `npm_config_global=true`，則 skip
- `postinstallCommand()` 內部呼叫共用 setup service，強制：
  - `interactive = false`
  - `quiet = true`
  - `forceEngine = false`
  - `forceConfig = false`
- 新增環境變數：
  - `ARS_SKIP_POSTINSTALL=1`：完全略過
  - `ARS_POSTINSTALL_STRICT=1`：讓 postinstall failure 轉成 non-zero exit code

#### 驗收條件

- `/tmp` 乾淨目錄 `npm install <local-path-or-tarball>` 後，會自動生成：
  - `.ars/config.json`
  - `.ars/.ars-version.json`
  - `src/engine/**`
  - `CLAUDE.md` marker block

### 4.3 版本管理強化

#### 目標行為

- 以 `.ars/.ars-version.json` 取代目前單用途的 `.ars/engine-version.json`
- 記錄 CLI package version、engine copy 來源、plugin version、安裝方式、時間戳
- `setup` / `update` 在寫入前先做版本比較，避免舊版 CLI 覆蓋新版安裝
- doctor 可檢查 runtime version / installed version / copied engine version 的 drift

#### 需要修改 / 新增的檔案

- 新增 `cli/lib/version.ts`
- 修改 `cli/lib/install.ts`
- 修改 `cli/commands/setup.ts`
- 修改 `cli/commands/update.ts`
- 修改 `cli/commands/doctor.ts`
- 新增 `cli/__tests__/version.test.ts`
- 新增 `cli/__tests__/installer-version-guard.test.ts`

#### 具體 API

```ts
export interface ArsVersionMetadata {
  version: string;
  installedAt: string;
  lastUpdatedAt?: string;
  installMethod: 'npm-local' | 'npm-global' | 'source';
  sourceCommit?: string;
  sourcePath?: string;
  pluginVersion?: string;
  engineSource?: string;
  configSchemaVersion: number;
}

export function getVersionFilePath(root?: string): string;
export function readInstalledVersion(root?: string): ArsVersionMetadata | null;
export function writeInstalledVersion(metadata: ArsVersionMetadata, root?: string): string;
export function compareVersions(a: string, b: string): number;
export function assertNoDowngrade(
  currentVersion: string | null,
  targetVersion: string,
): void;
```

#### metadata 格式

```json
{
  "version": "1.2.0",
  "installedAt": "2026-04-15T10:00:00.000Z",
  "lastUpdatedAt": "2026-04-15T10:05:00.000Z",
  "installMethod": "npm-local",
  "sourceCommit": "abc123",
  "sourcePath": "/path/to/ars",
  "pluginVersion": "0.1.0",
  "engineSource": "src/engine",
  "configSchemaVersion": 2
}
```

#### 相容策略

- 第一版先保留讀取 `.ars/engine-version.json` 的 fallback
- 若 `.ars/.ars-version.json` 不存在但舊檔存在，`setup/update` 第一次執行時自動遷移
- 防降級規則：
  - `installed.version > runtime.version` 時，`setup/update` 直接 fail
  - `--force-engine` 不可繞過防降級
  - 若未來需要 maintainer override，再新增 `--allow-downgrade`，不與本輪實作綁定

#### 驗收條件

- 新版 `setup/update` 一律產生 `.ars/.ars-version.json`
- 同 repo 先寫入較新版本 metadata，再用舊 package 跑 `setup/update` 會被拒絕
- doctor 能明確指出 `installed.version != runtime.version` 的狀態

### 4.4 setup / update / doctor 全面升級

#### 目標行為

- setup / update / doctor 共用同一套 install/version/config service
- 補齊 `--force` / `--force-engine` option family
- doctor 提供 human 與 JSON 兩種輸出
- config schema、plugin hook schema、engine install schema 三者一致

#### 需要修改 / 新增的檔案

- 修改 `cli/commands/setup.ts`
- 修改 `cli/commands/update.ts`
- 修改 `cli/commands/doctor.ts`
- 修改 `cli/lib/ars-config.ts`
- 修改 `plugin/scripts/session-start.mjs`
- 新增 `cli/lib/doctor/checks.ts`
- 新增 `cli/lib/doctor/types.ts`
- 新增 `cli/__tests__/doctor.test.ts`

#### 具體 API

```ts
export interface SetupOptions {
  force: boolean;
  forceEngine: boolean;
  forceConfig: boolean;
  forceClaudeMd: boolean;
  quiet: boolean;
  yes: boolean;
}

export interface UpdateOptions {
  force: boolean;
  forceEngine: boolean;
  forceClaudeMd: boolean;
  quiet: boolean;
}

export interface DoctorOptions {
  json: boolean;
  strict: boolean;
}

export interface DoctorCheckResult {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  fixHint?: string;
}
```

#### option family

- `ars setup --force`
  - 覆寫 config、engine、CLAUDE.md、version metadata
  - 跳過互動式確認
- `ars setup --force-engine`
  - 只強制覆寫 engine 與版本 metadata
  - 不改現有 config
- `ars update --force`
  - 強制 refresh engine + CLAUDE.md + version metadata
- `ars update --force-engine`
  - 僅 refresh engine 與 backup

#### config schema 對齊

`cli/lib/ars-config.ts` 必須補回與現有 plugin script 相容的 `llm` 區塊：

```ts
export interface ArsConfig {
  version: 2;
  llm: {
    default: 'anthropic' | 'openai' | 'noop';
    fallbacks: Array<'anthropic' | 'openai' | 'noop'>;
  };
  tts: { provider: 'none' | 'minimax' };
  publish: { youtube: { enabled: boolean; credentialsPath?: string; clientSecretPath?: string } };
  extensions: { social: { enabled: boolean }; analytics: { enabled: boolean } };
  review: { preferredUi: 'slides'; enableExperimentalStudio: boolean };
}
```

#### doctor 深度檢查項目

- `cli.node-version`
- `cli.claude-binary`
- `cli.tmux`
- `config.exists`
- `config.schema`
- `config.llm-default`
- `version.file`
- `version.drift`
- `engine.registry`
- `engine.root`
- `engine.template`
- `engine.composition`
- `plugin.manifest`
- `plugin.skills`
- `plugin.hooks`
- `claude-md.marker`
- `provider.minimax`
- `provider.youtube-credentials`

#### 驗收條件

- `ars doctor --json` 產出穩定 JSON，e2e 可直接 parse
- `.ars/config.json`、`plugin/scripts/session-start.mjs`、doctor 三者不再出現 `llm` schema drift
- `setup/update` 對相同 repo 重跑時是 idempotent

### 4.5 E2E 與 Regression Test 補齊

#### 目標行為

- 所有本次修改都可在 `/tmp` 乾淨目錄驗證
- 測試不依賴真實 `claude` 或真實 `tmux`
- 可以驗證 postinstall、bare launch、setup/update/doctor、版本 guard

#### 需要修改 / 新增的檔案

- 修改 `package.json`
- 新增 `vitest.config.ts`
- 新增 `cli/__tests__/cli-boot.test.ts`
- 新增 `cli/__tests__/launch.test.ts`
- 新增 `cli/__tests__/tmux-utils.test.ts`
- 新增 `cli/__tests__/version.test.ts`
- 新增 `cli/__tests__/postinstall.test.ts`
- 新增 `tests/e2e/clean-install.test.ts`
- 新增 `tests/e2e/helpers/fake-binaries.ts`

#### package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:cli": "vitest run cli/__tests__ tests/e2e"
  },
  "dependencies": {
    "commander": "^14.0.0"
  },
  "devDependencies": {
    "vitest": "^4.0.0"
  }
}
```

#### e2e 情境

- Case 1: clean project `npm install <ars tarball>` 後，自動 postinstall setup 成功
- Case 2: `npx ars doctor --json` 可 parse 並回傳 expected checks
- Case 3: `npx ars update --force-engine` 會建立 `.ars/backups/<timestamp>/engine`
- Case 4: `npx ars` bare launch，在 fake `claude` + fake `tmux` 下會走 outside-tmux path
- Case 5: `TMUX=1 npx ars` 會走 inside-tmux path
- Case 6: `npx ars --print foo` 不使用 tmux
- Case 7: 寫入較新 `.ars/.ars-version.json` 後，舊版 package `setup/update` 會被拒絕

#### fake binary 設計

- `tests/e2e/helpers/fake-binaries.ts` 在 temp `bin/` 內建立：
  - `claude`
  - `tmux`
- 兩者只把收到的 argv 寫到 temp log 檔
- e2e 透過 `PATH=<temp-bin>:$PATH` 驗證 ARS 實際傳遞的命令列

## 5. 實作優先順序

| Priority | 項目 | 說明 |
| --- | --- | --- |
| P0 | Commander bootstrap + bare `ars` launch | 先讓 `ars` 有正確的 root action、subcommand help、version、launch path |
| P0 | `.ars/.ars-version.json` + compareVersions + 防降級 | 沒有版本 guard，後面的 postinstall / update 都不安全 |
| P0 | config schema 對齊 | 先解掉 `llm.default` drift，否則 setup/doctor/e2e 都不穩 |
| P1 | postinstall 自動 setup | 依賴 P0 的 setup service 與 version metadata |
| P1 | setup/update force option family | 在 service 穩定後補齊 CLI surface |
| P1 | doctor 深度檢查 + `--json` | 作為 e2e 與使用者診斷入口 |
| P2 | 完整 e2e matrix + fake tmux/claude harness | 可與 P1 併行，但建議在 CLI surface 定案後補齊 |
| P2 | package name / publish metadata 清理 | package metadata 與 install/runtime package lookup 需持續保持一致，但不阻塞本輪 CLI refactor |

## 6. 工作量估計

| 項目 | 工作量 |
| --- | --- |
| Commander bootstrap + default launch | 中 |
| tmux launch layer | 中 |
| postinstall auto setup with `INIT_CWD` | 中 |
| `.ars/.ars-version.json` + compareVersions + downgrade guard | 中 |
| config schema 對齊 | 小 |
| setup/update option family refactor | 中 |
| doctor 深度檢查 + JSON output | 中 |
| CLI unit tests | 中 |
| `/tmp` clean-install e2e harness | 大 |

## 7. 潛在風險點

- `npm postinstall` 的 cwd 不是 consumer repo root，若不使用 `INIT_CWD` 會把 `.ars` 寫進 `node_modules`
- `claude --plugin-dir` 是否在所有目標 Claude CLI 版本都可用，需要 doctor 或 e2e 做兼容檢查
- tmux attach/new-session 在某些 terminal surface 可能失敗，必須保留 direct fallback
- 若 `--force` 被定義成可繞過 downgrade guard，會重新引入「舊版覆蓋新版」風險
- config schema 目前已實際漂移，若不先做 migration，doctor 可能在使用者現有 repo 上大量誤報
- package name drift 目前尚未爆炸，是因為 `locateSourcePackageRoot()` 有 fallback；一旦做 build/pack，這個 drift 很容易變成真 bug
- repo 目前沒有 test infra；若先改 launch 再補測試，回歸風險會很高

## 8. 建議實作順序

1. 先把 `cli/index.ts` 換成 Commander，補 `launch` / `postinstall` hidden command / `--version`
2. 補 `cli/lib/version.ts` 與 `.ars/.ars-version.json`，把 setup/update 改成共用 version service
3. 對齊 `ArsConfig` 與 `plugin/scripts/session-start.mjs`
4. 抽出 setup/update service，補 `--force` / `--force-engine`
5. 擴充 doctor checks 與 `--json`
6. 最後補齊 `/tmp` clean-install e2e harness

## 9. 完成定義

以下條件全部成立才算完成：

- `npm install <ars package>` 於乾淨 `/tmp` repo 會自動完成靜默 setup
- `npx ars` 無 subcommand 會啟動 Claude，並自動帶入 ARS plugin
- `npx ars setup/update/doctor --help` 顯示正確子命令 help
- `.ars/.ars-version.json` 存在，setup/update 具備防降級
- `npx ars doctor --json` 穩定可機器解析
- e2e 測試覆蓋 install、bare launch、setup、update、doctor、downgrade guard
