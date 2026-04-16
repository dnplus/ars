import fs from 'fs';
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
## ARS Commands
- \`/ars:setup\`：ARS 的正式首次入口；先訪談頻道風格，再安裝/同步 engine、初始化 series、套用主題
- \`/ars:doctor\`：檢查 ARS 設定、engine 安裝狀態與 provider 憑證
- \`/ars:plan\`：討論主題、建立 episode 計畫，並寫入 \`.ars/episodes/<epId>/\` artifacts
- \`/ars:build\`：依 \`plan.md\` 實作 episode source
- \`/ars:episode-create\`：低階 episode scaffold primitive，通常由 \`/ars:plan\` 自動觸發
- \`/ars:review-open\`：開啟 review surface，針對目前 repo 的 episode 審稿
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

  return copied;
}

export function backupEngine(root = getTargetRepoRoot()): string {
  const targetEngineDir = path.join(root, 'src', 'engine');
  if (!fs.existsSync(targetEngineDir)) {
    throw new Error(`Missing ${targetEngineDir}. Run "npx ars setup" first.`);
  }

  const backupTimestamp = new Date().toISOString().replace(/:/g, '-');
  const backupEngineDir = path.join(
    getArsDir(root),
    'backups',
    backupTimestamp,
    'engine',
  );
  copyDirectory(targetEngineDir, backupEngineDir, { overwrite: false });
  return backupEngineDir;
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
