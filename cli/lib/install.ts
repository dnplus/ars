import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { getArsDir } from './ars-config';
import { getRuntimePackageInfo } from './runtime-package';
import {
  ArsInstallMethod,
  ArsVersionMetadata,
  assertNoDowngrade,
  getLegacyEngineVersionPath,
  readInstalledVersion,
  writeInstalledVersion,
} from './version';

const PACKAGE_NAME = 'agentic-remotion-studio';
const ARS_MARKER_BEGIN = '<!-- ars:begin -->';
const ARS_MARKER_END = '<!-- ars:end -->';
const ARS_COMMANDS_BLOCK = `${ARS_MARKER_BEGIN}
## ARS

**重要**：ARS hooks（stage tracking、workstate）需要透過 \`ars\` launcher 啟動 Claude Code 才能生效。
在此 repo 目錄下執行 \`ars\` 啟動，不要直接用 \`claude\`。

## ARS Commands
- \`/ars:onboard\`：ARS 的正式首次入口；先訪談頻道風格，再確認 repo 已完成 \`npx ars init <series>\`、初始化主題與品牌預設
- \`/ars:doctor\`：檢查 ARS 設定、engine 安裝狀態與 provider 憑證
- \`/ars:plan\`：討論主題、建立 episode 計畫，並寫入 \`.ars/episodes/<epId>/\` artifacts
- \`/ars:build\`：依 \`plan.md\` 實作 episode source
- \`/ars:episode-create\`：低階 episode scaffold primitive，通常由 \`/ars:plan\` 自動觸發
- \`/ars:review\`：開啟 review surface，針對目前 repo 的 episode 審稿，並進入 intent polling loop
- \`/ars:apply-review\`：根據 review intents 將修正套回 episode source
- \`/ars:polish\`：只做後段 refinement，不重寫整集結構
- \`/ars:prepare-youtube\`：整理 YouTube metadata 與發布前檢查
- \`/ars:publish-youtube\`：在人工確認後執行 YouTube 發布流程
- \`/ars:new-card\`：為指定 series 建立新的 custom card，scaffold spec.ts + component.tsx
- \`/ars:theme\`：為指定 series 產生或調整視覺主題
- \`/ars:analytics\`：查詢 YouTube analytics 並產出頻道摘要報告
${ARS_MARKER_END}`;

interface PackageJsonLike {
  name?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface InstallState {
  configExists: boolean;
  engineExists: boolean;
  versionExists: boolean;
  claudeMdPatched: boolean;
}

export interface SyncEngineOptions {
  root: string;
  sourceRoot: string;
  overwriteEngine: boolean;
  overwriteSupportFiles: boolean;
}

export function getTargetRepoRoot(): string {
  return process.cwd();
}

export function getEngineVersionPath(root = getTargetRepoRoot()): string {
  return getLegacyEngineVersionPath(root);
}

export function locateSourcePackageRoot(importMetaUrl: string): string {
  return getRuntimePackageInfo(importMetaUrl).packageRoot;
}

export function resolveSetupTargetRoot(
  env: NodeJS.ProcessEnv,
  packageRoot: string,
): string | null {
  if (env.ARS_SKIP_POSTINSTALL === '1') {
    return null;
  }

  if (env.npm_config_global === 'true') {
    return null;
  }

  const initCwd = env.INIT_CWD?.trim();
  if (!initCwd) {
    return null;
  }

  const resolved = path.resolve(initCwd);
  const normalizedPackageRoot = path.resolve(packageRoot);
  if (resolved === normalizedPackageRoot) {
    return null;
  }

  if (resolved.includes(`${path.sep}node_modules${path.sep}`)) {
    return null;
  }

  return resolved;
}

export function detectInstallState(root = getTargetRepoRoot()): InstallState {
  const claudePath = path.join(root, 'CLAUDE.md');
  const claudeContent = fs.existsSync(claudePath)
    ? fs.readFileSync(claudePath, 'utf-8')
    : '';

  return {
    configExists: fs.existsSync(path.join(getArsDir(root), 'config.json')),
    engineExists: fs.existsSync(path.join(root, 'src', 'engine')),
    versionExists: readInstalledVersion(root) !== null,
    claudeMdPatched:
      claudeContent.includes(ARS_MARKER_BEGIN) &&
      claudeContent.includes(ARS_MARKER_END),
  };
}

export function isArsDevelopmentRepo(
  targetRoot: string,
  sourceRoot: string,
): boolean {
  if (samePath(targetRoot, sourceRoot)) {
    return true;
  }

  if (!hasArsSourceLayout(targetRoot)) {
    return false;
  }

  return readPackageName(targetRoot) === PACKAGE_NAME;
}

export function copyDirectory(
  sourcePath: string,
  targetPath: string,
  options: { overwrite: boolean },
): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    force: options.overwrite,
    errorOnExist: !options.overwrite,
  });
}

export function copyFile(
  sourcePath: string,
  targetPath: string,
  options: { overwrite: boolean },
): boolean {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(
    sourcePath,
    targetPath,
    options.overwrite ? 0 : fs.constants.COPYFILE_EXCL,
  );
  return true;
}

export function patchClaudeMd(root = getTargetRepoRoot()): string {
  const claudePath = path.join(root, 'CLAUDE.md');
  const existing = fs.existsSync(claudePath)
    ? fs.readFileSync(claudePath, 'utf-8')
    : '';

  const beginIndex = existing.indexOf(ARS_MARKER_BEGIN);
  const endIndex = existing.indexOf(ARS_MARKER_END);

  let next = existing.trimEnd();
  if (beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex) {
    const before = existing.slice(0, beginIndex).trimEnd();
    const after = existing.slice(endIndex + ARS_MARKER_END.length).trimStart();
    next = [before, ARS_COMMANDS_BLOCK, after].filter(Boolean).join('\n\n');
  } else if (next.length > 0) {
    next = `${next}\n\n${ARS_COMMANDS_BLOCK}`;
  } else {
    next = ARS_COMMANDS_BLOCK;
  }

  fs.writeFileSync(claudePath, `${next}\n`, 'utf-8');
  return claudePath;
}

export function getSourceGitCommit(sourceRoot: string): string {
  const gitResult = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: sourceRoot,
    encoding: 'utf-8',
  });

  if (gitResult.status === 0) {
    return gitResult.stdout.trim();
  }

  const packageJsonPath = path.join(sourceRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf-8'),
    ) as { gitHead?: unknown; version?: unknown };
    if (typeof pkg.gitHead === 'string' && pkg.gitHead.trim()) {
      return pkg.gitHead.trim();
    }
    if (typeof pkg.version === 'string' && pkg.version.trim()) {
      return `version:${pkg.version.trim()}`;
    }
  }

  throw new Error(
    `Failed to resolve source commit from ${sourceRoot}: ${
      gitResult.stderr.trim() || 'git rev-parse HEAD failed'
    }`,
  );
}

export function syncEngineFiles(options: SyncEngineOptions): string[] {
  const copied: string[] = [];
  const sourceEngineDir = path.join(options.sourceRoot, 'src', 'engine');
  const targetEngineDir = path.join(options.root, 'src', 'engine');
  syncDirectoryIfNeeded(
    sourceEngineDir,
    targetEngineDir,
    options.overwriteEngine,
    'engine/',
    copied,
  );

  const sourceTemplateDir = path.join(
    options.sourceRoot,
    'src',
    'episodes',
    'template',
  );
  const targetTemplateDir = path.join(options.root, 'src', 'episodes', 'template');
  syncDirectoryIfNeeded(
    sourceTemplateDir,
    targetTemplateDir,
    options.overwriteSupportFiles,
    'episodes/template/',
    copied,
  );

  syncFileIfNeeded(
    path.join(options.sourceRoot, 'src', 'Root.tsx'),
    path.join(options.root, 'src', 'Root.tsx'),
    options.overwriteSupportFiles,
    'Root.tsx',
    copied,
  );

  // Review surface support files
  syncDirectoryIfNeeded(
    path.join(options.sourceRoot, 'src', 'review'),
    path.join(options.root, 'src', 'review'),
    options.overwriteSupportFiles,
    'review/',
    copied,
  );

  syncDirectoryIfNeeded(
    path.join(options.sourceRoot, 'src', 'types'),
    path.join(options.root, 'src', 'types'),
    options.overwriteSupportFiles,
    'types/',
    copied,
  );

  for (const file of ['studio.html', 'studio-main.tsx', 'index.ts', 'index.css', 'global.d.ts']) {
    syncFileIfNeeded(
      path.join(options.sourceRoot, 'src', file),
      path.join(options.root, 'src', file),
      options.overwriteSupportFiles,
      file,
      copied,
    );
  }

  syncFileIfNeeded(
    path.join(options.sourceRoot, 'vite.studio.config.ts'),
    path.join(options.root, 'vite.studio.config.ts'),
    options.overwriteSupportFiles,
    'vite.studio.config.ts',
    copied,
  );

  syncFileIfNeeded(
    path.join(options.sourceRoot, 'remotion.config.ts'),
    path.join(options.root, 'remotion.config.ts'),
    options.overwriteSupportFiles,
    'remotion.config.ts',
    copied,
  );

  syncFileIfNeeded(
    path.join(options.sourceRoot, 'tsconfig.json'),
    path.join(options.root, 'tsconfig.json'),
    options.overwriteSupportFiles,
    'tsconfig.json',
    copied,
  );

  // Static assets: fonts and shared audio required by the studio
  syncDirectoryIfNeeded(
    path.join(options.sourceRoot, 'public', 'shared'),
    path.join(options.root, 'public', 'shared'),
    options.overwriteSupportFiles,
    'public/shared/',
    copied,
  );

  // Bootstrap package.json if not present
  const consumerPkgPath = path.join(options.root, 'package.json');
  if (!fs.existsSync(consumerPkgPath)) {
    const generated = generateConsumerPackageJson(options.sourceRoot);
    fs.writeFileSync(consumerPkgPath, JSON.stringify(generated, null, 2) + '\n', 'utf-8');
    copied.push('package.json (generated)');
  }

  return copied;
}

function generateConsumerPackageJson(sourceRoot: string): Record<string, unknown> {
  // Extract deps from ARS source package.json to avoid hardcoding versions
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  const srcPkgPath = path.join(sourceRoot, 'package.json');
  if (fs.existsSync(srcPkgPath)) {
    try {
      const src = JSON.parse(fs.readFileSync(srcPkgPath, 'utf-8')) as PackageJsonLike;
      dependencies = src.dependencies ?? {};
      devDependencies = src.devDependencies ?? {};
    } catch { /* ignore */ }
  }

  // Remove ARS-internal-only entries not needed in consumer repos
  const { tsx: _tsx, ...consumerDeps } = dependencies as Record<string, string>;
  void _tsx;

  return {
    name: 'my-ars-channel',
    version: '1.0.0',
    private: true,
    engines: { node: '>=22.12.0' },
    scripts: {
      dev: 'remotion studio',
      build: 'remotion bundle',
      lint: 'eslint src && tsc',
      test: 'vitest run',
      'dev:studio': 'vite --config vite.studio.config.ts',
      'build:studio': 'vite build --config vite.studio.config.ts',
    },
    dependencies: consumerDeps,
    devDependencies,
    sideEffects: ['*.css'],
  };
}

export function backupEngine(root = getTargetRepoRoot()): string {
  const targetEngineDir = path.join(root, 'src', 'engine');
  if (!fs.existsSync(targetEngineDir)) {
    throw new Error(`Missing ${targetEngineDir}. Run "npx ars init <series>" first.`);
  }

  const backupsRoot = path.join(getArsDir(root), 'backups');
  const backupTimestamp = new Date().toISOString().replace(/:/g, '-');
  const backupEngineDir = path.join(
    backupsRoot,
    backupTimestamp,
    'engine',
  );
  copyDirectory(targetEngineDir, backupEngineDir, { overwrite: false });
  pruneOldEngineBackups(backupsRoot);
  return backupEngineDir;
}

const ENGINE_BACKUP_RETENTION_COUNT = 3;

function pruneOldEngineBackups(backupsRoot: string): void {
  if (!fs.existsSync(backupsRoot)) {
    return;
  }

  const timestampDirs = fs.readdirSync(backupsRoot)
    .map((name) => ({
      name,
      fullPath: path.join(backupsRoot, name),
    }))
    .filter((entry) => fs.statSync(entry.fullPath).isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const entry of timestampDirs.slice(ENGINE_BACKUP_RETENTION_COUNT)) {
    fs.rmSync(entry.fullPath, { recursive: true, force: true });
  }
}

export function writeVersionMetadata(options: {
  root: string;
  sourceRoot: string;
  runtimeVersion: string;
  pluginVersion: string;
  configSchemaVersion: number;
  installMethod: ArsInstallMethod;
}): string {
  const current = readInstalledVersion(options.root);
  assertNoDowngrade(current?.version ?? null, options.runtimeVersion);

  const timestamp = new Date().toISOString();
  const metadata: ArsVersionMetadata = {
    version: options.runtimeVersion,
    installedAt: current?.installedAt ?? timestamp,
    lastUpdatedAt: timestamp,
    installMethod: options.installMethod,
    sourceCommit: getSourceGitCommit(options.sourceRoot),
    sourcePath: options.sourceRoot,
    pluginVersion: options.pluginVersion,
    engineSource: 'src/engine',
    configSchemaVersion: options.configSchemaVersion,
  };

  return writeInstalledVersion(metadata, options.root);
}

export function detectInstallMethod(
  sourceRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): ArsInstallMethod {
  if (env.npm_config_global === 'true') {
    return 'npm-global';
  }

  if (sourceRoot.includes(`${path.sep}node_modules${path.sep}`)) {
    return 'npm-local';
  }

  return 'source';
}

/**
 * Copy ARS plugin skills into the repo's .claude/skills/ars/ directory so that
 * Claude Code can discover them without requiring --plugin-dir at launch time.
 *
 * Each skill lives at plugin/skills/<name>/SKILL.md and is copied to
 * .claude/skills/ars/<name>/SKILL.md in the target repo.
 *
 * Returns the list of skill names that were installed.
 */
export function syncAgents(options: {
  root: string;
  pluginRoot: string;
  overwrite: boolean;
}): string[] {
  const { root, pluginRoot, overwrite } = options;
  const sourceAgentsDir = path.join(pluginRoot, 'agents');
  const targetAgentsDir = path.join(root, '.claude', 'agents');

  if (!fs.existsSync(sourceAgentsDir)) {
    return [];
  }

  const installed: string[] = [];

  for (const file of fs.readdirSync(sourceAgentsDir)) {
    if (!file.endsWith('.md')) continue;

    const sourcePath = path.join(sourceAgentsDir, file);
    // Agent file stays as-is: planner.md → .claude/agents/planner.md
    // Claude Code discovers it under the namespace from the frontmatter name field
    const targetPath = path.join(targetAgentsDir, file);
    if (fs.existsSync(targetPath) && !overwrite) continue;

    fs.mkdirSync(targetAgentsDir, { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    installed.push(file.replace(/\.md$/, ''));
  }

  return installed;
}

export function syncSkills(options: {
  root: string;
  pluginRoot: string;
  overwrite: boolean;
}): string[] {
  const { root, pluginRoot, overwrite } = options;
  const sourceSkillsDir = path.join(pluginRoot, 'skills');
  const targetSkillsBaseDir = path.join(root, '.claude', 'skills');

  if (!fs.existsSync(sourceSkillsDir)) {
    return [];
  }

  const installed: string[] = [];

  for (const name of fs.readdirSync(sourceSkillsDir)) {
    const sourceSkillMd = path.join(sourceSkillsDir, name, 'SKILL.md');
    if (!fs.existsSync(sourceSkillMd)) continue;

    // Skill name becomes "ars:<name>" so it's invoked as /ars:<name>
    const targetSkillMd = path.join(targetSkillsBaseDir, `ars:${name}`, 'SKILL.md');
    if (fs.existsSync(targetSkillMd) && !overwrite) continue;

    fs.mkdirSync(path.dirname(targetSkillMd), { recursive: true });
    fs.copyFileSync(sourceSkillMd, targetSkillMd);
    installed.push(name);
  }

  return installed;
}

function syncDirectoryIfNeeded(
  sourcePath: string,
  targetPath: string,
  overwrite: boolean,
  label: string,
  copied: string[],
): void {
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  if (fs.existsSync(targetPath) && !overwrite) {
    return;
  }
  copyDirectory(sourcePath, targetPath, { overwrite });
  copied.push(`${label} ← ${sourcePath}`);
}

function syncFileIfNeeded(
  sourcePath: string,
  targetPath: string,
  overwrite: boolean,
  label: string,
  copied: string[],
): void {
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  if (fs.existsSync(targetPath) && !overwrite) {
    return;
  }
  copyFile(sourcePath, targetPath, { overwrite });
  copied.push(`${label} ← ${sourcePath}`);
}

function hasArsSourceLayout(root: string): boolean {
  return (
    fs.existsSync(path.join(root, 'plugin', '.claude-plugin', 'plugin.json')) &&
    fs.existsSync(path.join(root, 'src', 'engine'))
  );
}

function readPackageName(root: string): string | null {
  const packageJsonPath = path.join(root, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const pkg = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8'),
  ) as PackageJsonLike;
  return typeof pkg.name === 'string' ? pkg.name : null;
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}

/**
 * Install the ARS statusline wrapper into the user's global Claude config.
 *
 * Steps:
 *  1. Copy plugin/scripts/ars-statusline.mjs → ~/.claude/ars-statusline.mjs
 *  2. Read ~/.claude/settings.json; if statusLine.command exists and is not
 *     already the ARS wrapper, save it as the delegate in
 *     ~/.claude/ars-statusline-config.json
 *  3. Overwrite settings.json statusLine to point at the wrapper
 *
 * Returns 'installed' | 'already-installed' | 'skipped' (no settings.json).
 */
export function installStatusLine(pluginRoot: string): 'installed' | 'already-installed' | 'skipped' {
  const claudeDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const wrapperDest = path.join(claudeDir, 'ars-statusline.mjs');
  const configDest = path.join(claudeDir, 'ars-statusline-config.json');
  const wrapperSrc = path.join(pluginRoot, 'scripts', 'ars-statusline.mjs');

  if (!fs.existsSync(wrapperSrc)) {
    return 'skipped';
  }

  const pluginScriptsDir = path.join(pluginRoot, 'scripts');
  const arsVersion = readPluginVersionFromRoot(pluginRoot);
  const wrapperCommand = `node "${wrapperDest}"`;

  const patchConfig = (extra: Record<string, unknown> = {}): void => {
    let cfg: Record<string, unknown> = {};
    if (fs.existsSync(configDest)) {
      try { cfg = JSON.parse(fs.readFileSync(configDest, 'utf-8')) as Record<string, unknown>; } catch { /* ignore */ }
    }
    Object.assign(cfg, { pluginScriptsDir, arsVersion: arsVersion ?? '' }, extra);
    fs.writeFileSync(configDest, `${JSON.stringify(cfg, null, 2)}\n`, 'utf-8');
  };

  if (fs.existsSync(settingsPath)) {
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
    const existing = raw.statusLine as Record<string, unknown> | undefined;

    if (existing?.command === wrapperCommand) {
      fs.copyFileSync(wrapperSrc, wrapperDest);
      patchConfig();
      return 'already-installed';
    }

    const existingCommand = typeof existing?.command === 'string' ? existing.command.trim() : '';
    patchConfig(existingCommand && existingCommand !== wrapperCommand ? { delegate: existingCommand } : {});

    raw.statusLine = { type: 'command', command: wrapperCommand };
    fs.writeFileSync(settingsPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf-8');
  } else {
    fs.mkdirSync(claudeDir, { recursive: true });
    const settings = { statusLine: { type: 'command', command: wrapperCommand } };
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
    patchConfig({ delegate: '' });
  }

  fs.copyFileSync(wrapperSrc, wrapperDest);
  return 'installed';
}

/**
 * Copy ARS hook scripts into the consumer repo's .ars/hooks/scripts/ directory
 * so hooks can reference them via repo-relative paths (independent of $CLAUDE_PLUGIN_ROOT).
 *
 * Copies all .mjs files from plugin/scripts/ and the entire lib/ subdirectory.
 * Returns the list of script names that were copied.
 */
export function syncHookScripts(options: {
  root: string;
  pluginRoot: string;
  overwrite: boolean;
}): string[] {
  const { root, pluginRoot, overwrite } = options;
  const sourceScriptsDir = path.join(pluginRoot, 'scripts');
  const targetScriptsDir = path.join(root, '.ars', 'hooks', 'scripts');

  if (!fs.existsSync(sourceScriptsDir)) {
    return [];
  }

  const copied: string[] = [];

  // Copy top-level .mjs hook scripts
  for (const file of fs.readdirSync(sourceScriptsDir)) {
    if (!file.endsWith('.mjs')) continue;
    const src = path.join(sourceScriptsDir, file);
    const dst = path.join(targetScriptsDir, file);
    if (fs.existsSync(dst) && !overwrite) continue;
    fs.mkdirSync(targetScriptsDir, { recursive: true });
    fs.copyFileSync(src, dst);
    copied.push(file);
  }

  // Copy lib/ subdirectory (ars-workstate.mjs and friends)
  const sourceLibDir = path.join(sourceScriptsDir, 'lib');
  const targetLibDir = path.join(targetScriptsDir, 'lib');
  if (fs.existsSync(sourceLibDir)) {
    for (const file of fs.readdirSync(sourceLibDir)) {
      if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;
      const src = path.join(sourceLibDir, file);
      const dst = path.join(targetLibDir, file);
      if (fs.existsSync(dst) && !overwrite) continue;
      fs.mkdirSync(targetLibDir, { recursive: true });
      fs.copyFileSync(src, dst);
      copied.push(`lib/${file}`);
    }
  }

  return copied;
}

/**
 * Patch the consumer repo's .claude/settings.json to wire ARS hooks via
 * repo-relative paths (.ars/hooks/scripts/...) instead of $CLAUDE_PLUGIN_ROOT.
 *
 * This avoids conflicts when $CLAUDE_PLUGIN_ROOT is taken by another plugin (e.g. OMC).
 * Existing non-ARS hook entries are preserved; ARS entries are replaced.
 */
export function patchClaudeSettings(options: {
  root: string;
}): void {
  const { root } = options;
  const settingsPath = path.join(root, '.claude', 'settings.json');

  // ARS hook definitions using repo-relative script paths
  const arsHooks: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string; timeout: number }> }>> = {
    UserPromptSubmit: [
      {
        matcher: '*',
        hooks: [
          { type: 'command', command: 'node ".ars/hooks/scripts/keyword-detector.mjs"', timeout: 3 },
          { type: 'command', command: 'node ".ars/hooks/scripts/prompt-stage-context.mjs"', timeout: 3 },
        ],
      },
    ],
    SessionStart: [
      {
        matcher: '*',
        hooks: [
          { type: 'command', command: 'node ".ars/hooks/scripts/session-start.mjs"', timeout: 5 },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: '*',
        hooks: [
          { type: 'command', command: 'node ".ars/hooks/scripts/post-tool-use-stage.mjs"', timeout: 3 },
        ],
      },
    ],
    Stop: [
      {
        matcher: '*',
        hooks: [
          { type: 'command', command: 'node ".ars/hooks/scripts/review-intent-stop.mjs"', timeout: 3 },
        ],
      },
    ],
  };

  // Load existing settings or start fresh
  let settings: Record<string, unknown> = {};
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
    } catch { /* start fresh */ }
  }

  // ARS hook command fingerprint — used to detect existing ARS entries
  const ARS_HOOK_MARKER = '.ars/hooks/scripts/';

  for (const [event, arsEntries] of Object.entries(arsHooks)) {
    const existing = Array.isArray(settings[event])
      ? (settings[event] as Array<unknown>)
      : [];

    // Remove any pre-existing ARS hook entries (identified by marker in command string)
    const nonArs = existing.filter((entry) => {
      if (typeof entry !== 'object' || entry === null) return true;
      const e = entry as Record<string, unknown>;
      const hooks = Array.isArray(e.hooks) ? e.hooks : [];
      return !hooks.some((h) => {
        if (typeof h !== 'object' || h === null) return false;
        const hh = h as Record<string, unknown>;
        return typeof hh.command === 'string' && hh.command.includes(ARS_HOOK_MARKER);
      });
    });

    settings[event] = [...arsEntries, ...nonArs];
  }

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
}

function readPluginVersionFromRoot(pluginRoot: string): string | null {
  // pluginRoot is the plugin/ subdirectory; package.json lives one level up (the package root)
  for (const dir of [pluginRoot, path.dirname(pluginRoot)]) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { version?: unknown };
      if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
    } catch { /* try next */ }
  }
  return null;
}
