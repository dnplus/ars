import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { getArsDir } from './ars-config';
import {
  BACKUP_MANIFEST_SCHEMA_VERSION,
  BackupEntry,
  BackupManifest,
  writeManifest,
} from './backup-manifest';
import { getRuntimePackageInfo } from './runtime-package';
import { iterArsOwnedFiles } from './sync-paths';
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

## ARS Agent Role
- This repo uses ARS: an agent-driven workflow for turning source material into publishable Remotion video episodes.
- Your primary job in this repo is to help create and iterate on video episodes, not to treat this like a generic app repo.

## ARS Operating Principles
- Prefer episode artifacts and series structure over ad-hoc workflows.
- Keep planning, implementation, and review as separate passes.
- Reuse existing series-scoped assets before adding new ones.
- Preserve series continuity unless the user explicitly wants to change it.
- When implementing Remotion code, use the installed \`remotion-best-practices\` skill.

## Important Paths
- \`SERIES_GUIDE.md\` — series-level background knowledge and defaults for audience, tone, pacing, CTA, and visual direction
- \`.ars/episodes/<epId>/\` — planning and workflow artifacts for each episode
- \`.ars/episodes/<epId>/plan.md\` — canonical episode handoff for planning and build
- \`src/episodes/<series>/\` — series source, episode files, series config, and series-scoped cards
- \`src/episodes/<series>/series-config.ts\` — series theme, shell layout, and episode defaults
- \`src/episodes/<series>/cards/\` — series-scoped extension point for adding or overriding cards
- \`src/engine/\` — shared Remotion engine and built-in cards/layouts

## ARS Repo Notes
- One repo maps to one active series.
- Treat \`.ars/episodes/<epId>/plan.md\` as the canonical episode intent handoff.
- \`shell.layout\` may use a built-in key or a series custom layout component.
- \`src/episodes/<series>/cards/\` is the series-scoped extension point for adding or overriding cards.
- Series-scoped cards may add new card types or override built-in cards by reusing the same \`type\`.
${ARS_MARKER_END}`;

interface PackageJsonLike {
  name?: unknown;
  version?: unknown;
  private?: unknown;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  sideEffects?: unknown;
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

/**
 * Sync every ARS-owned file from the installed package into the consumer repo.
 *
 * The set of paths is derived from `package.json#files` (read via
 * iterArsOwnedFiles in cli/lib/sync-paths.ts) — that is the same inventory npm
 * uses when publishing the tarball, so it is the only correct definition of
 * "what consumers should receive". Adding a new file under any included
 * directory automatically lands here on next update; no allow-list to update.
 *
 * Two compounding pieces still live alongside the file walker:
 *   • package.json itself is generated/merged via syncPackageJson, not copied
 *   • .gitignore is line-merged via syncGitIgnore, not copied
 * Both have content-aware merge semantics that a generic file copy would
 * destroy, so they stay as dedicated calls below the walk.
 */
export function syncEngineFiles(options: SyncEngineOptions): string[] {
  const copied: string[] = [];
  const owned = iterArsOwnedFiles(options.sourceRoot);

  for (const entry of owned) {
    const targetPath = path.join(options.root, entry.relPath);
    const overwrite = entry.category === 'engine'
      ? options.overwriteEngine
      : options.overwriteSupportFiles;
    syncFileIfNeeded(entry.sourceAbs, targetPath, overwrite, entry.relPath, copied);
  }

  syncGitIgnore(options.root, copied);
  syncPackageJson(options.sourceRoot, options.root, copied);

  return copied;
}

function generateConsumerPackageJson(sourceRoot: string): PackageJsonLike {
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

  return {
    name: 'my-ars-channel',
    version: '1.0.0',
    private: true,
    engines: { node: '>=22.12.0' },
    scripts: {
      dev: 'remotion studio',
      build: 'remotion bundle',
      lint: 'eslint src && tsc',
      test: 'vitest run --passWithNoTests',
      'dev:studio': 'vite --config vite.studio.config.ts',
      'build:studio': 'vite build --config vite.studio.config.ts',
    },
    dependencies,
    devDependencies,
    sideEffects: ['*.css'],
  };
}

function syncPackageJson(sourceRoot: string, root: string, copied: string[]): void {
  const consumerPkgPath = path.join(root, 'package.json');
  const generated = generateConsumerPackageJson(sourceRoot);

  if (!fs.existsSync(consumerPkgPath)) {
    fs.writeFileSync(consumerPkgPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf-8');
    copied.push('package.json (generated)');
    return;
  }

  let current: PackageJsonLike;
  try {
    current = JSON.parse(fs.readFileSync(consumerPkgPath, 'utf-8')) as PackageJsonLike;
  } catch {
    return;
  }

  const next: PackageJsonLike = { ...current };
  let changed = false;

  if (!next.engines) {
    next.engines = generated.engines;
    changed = true;
  }

  const requiredScripts = generated.scripts ?? {};
  const existingScripts = isRecord(next.scripts) ? next.scripts : {};
  const mergedScripts = { ...existingScripts };
  for (const [name, command] of Object.entries(requiredScripts)) {
    if (typeof mergedScripts[name] !== 'string') {
      mergedScripts[name] = command;
      changed = true;
    }
  }
  if (changed || next.scripts !== mergedScripts) {
    next.scripts = mergedScripts;
  }

  const dependencyFields = ['dependencies', 'devDependencies'] as const;
  for (const field of dependencyFields) {
    const required = generated[field] ?? {};
    const existing = isRecord(next[field]) ? next[field] : {};
    const merged = { ...existing };
    let fieldChanged = false;
    for (const [name, version] of Object.entries(required)) {
      if (typeof merged[name] !== 'string') {
        merged[name] = version;
        fieldChanged = true;
      }
    }
    if (fieldChanged || next[field] !== merged) {
      next[field] = merged;
    }
    if (fieldChanged) {
      changed = true;
    }
  }

  if (next.sideEffects === undefined) {
    next.sideEffects = generated.sideEffects;
    changed = true;
  }

  if (!changed) {
    return;
  }

  fs.writeFileSync(consumerPkgPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
  copied.push('package.json (updated)');
}

function syncGitIgnore(root: string, copied: string[]): void {
  const targetPath = path.join(root, '.gitignore');
  const requiredEntries = [
    '.env',
    '.ars/config.json',
    '.ars/state/',
    '.ars/review-intents/',
    'node_modules/',
    'output/',
    'dist/',
    '.cache/',
    '.omc/',
    '.playwright-mcp/',
    '.codex/',
    'build/',
    '.claude/',
    '.DS_Store',
  ];
  const existing = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf-8')
    : '';
  const lines = existing.split(/\r?\n/);
  const normalized = new Set(lines.map((line) => line.trim()).filter(Boolean));
  const missing = requiredEntries.filter((entry) => !normalized.has(entry));

  if (missing.length === 0) {
    return;
  }

  const next = [
    existing.trimEnd(),
    ...missing,
  ].filter(Boolean).join('\n');
  fs.writeFileSync(targetPath, `${next}\n`, 'utf-8');
  copied.push('.gitignore');
}

function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ArsAssetBackup {
  /** Top-level timestamp directory under .ars/backups/. */
  timestampDir: string;
  /** Full path of the manifest file describing what was snapshotted. */
  manifestPath: string;
  /** Number of paths captured (not including the manifest itself). */
  entryCount: number;
}

export interface BackupArsAssetsOptions {
  /** Consumer repo root. Defaults to process.cwd(). */
  root?: string;
  /**
   * Source ARS package root. When provided, the backup uses
   * iterArsOwnedFiles(sourceRoot) to determine the package-derived paths to
   * snapshot, guaranteeing backup-range matches the next sync's target-range.
   * If omitted (legacy callers), only the well-known plugin-derived paths
   * (.claude/, .ars/hooks/) are snapshotted.
   */
  sourceRoot?: string;
}

/**
 * Plugin-derived asset paths in the consumer repo. These are written by
 * syncSkills / syncAgents / syncHookScripts from the package's plugin/
 * directory but land outside the package-files mirror, so they need explicit
 * backup coverage. Each entry is a directory under the consumer root.
 */
const PLUGIN_DERIVED_BACKUP_DIRS: readonly string[] = [
  '.claude/agents',
  '.ars/hooks/scripts',
];

/**
 * Snapshot every ARS-owned asset that `npx ars update` is about to overwrite,
 * and write a manifest so `npx ars rollback` can restore the snapshot without
 * relying on platform-specific shell commands.
 *
 * Coverage = the union of:
 *   - iterArsOwnedFiles(sourceRoot): every package-mirrored file (when a
 *     sourceRoot is provided; this is the same iterator syncEngineFiles uses
 *     so backup-range and sync-range cannot drift apart).
 *   - PLUGIN_DERIVED_BACKUP_DIRS: .claude/agents/ and .ars/hooks/scripts/,
 *     plus every .claude/skills/ars:* sibling that exists at backup time.
 *
 * Anything that exists in the consumer repo at one of those paths gets copied
 * into the per-timestamp snapshot directory. Paths that don't exist yet
 * (first-time install, optional features) are simply skipped.
 */
export function backupArsAssets(options: BackupArsAssetsOptions = {}): ArsAssetBackup {
  const root = options.root ?? getTargetRepoRoot();
  const targetEngineDir = path.join(root, 'src', 'engine');
  if (!fs.existsSync(targetEngineDir)) {
    throw new Error(`Missing ${targetEngineDir}. Run "npx ars init <series>" first.`);
  }

  const backupsRoot = path.join(getArsDir(root), 'backups');
  const backupTimestamp = new Date().toISOString().replace(/:/g, '-');
  const timestampDir = path.join(backupsRoot, backupTimestamp);
  const snapshotRoot = path.join(timestampDir, 'snapshot');

  const targetPaths = collectBackupTargets(root, options.sourceRoot);
  const entries: BackupEntry[] = [];

  for (const target of targetPaths) {
    const sourceAbs = path.join(root, target.relPath);
    if (!fs.existsSync(sourceAbs)) continue;
    const stat = fs.statSync(sourceAbs);
    const snapshotAbs = path.join(snapshotRoot, target.relPath);
    if (stat.isDirectory()) {
      copyDirectory(sourceAbs, snapshotAbs, { overwrite: false });
      entries.push({
        targetRelPath: target.relPath,
        snapshotRelPath: path.posix.join('snapshot', target.relPath.replace(/\\/g, '/')),
        kind: 'directory',
      });
    } else if (stat.isFile()) {
      copyFile(sourceAbs, snapshotAbs, { overwrite: false });
      entries.push({
        targetRelPath: target.relPath,
        snapshotRelPath: path.posix.join('snapshot', target.relPath.replace(/\\/g, '/')),
        kind: 'file',
      });
    }
  }

  const manifest: BackupManifest = {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    source: 'update',
    repoRoot: root,
    entries,
  };
  writeManifest(timestampDir, manifest);

  pruneOldArsAssetBackups(backupsRoot);
  return {
    timestampDir,
    manifestPath: path.join(timestampDir, 'manifest.json'),
    entryCount: entries.length,
  };
}

interface BackupTarget {
  /** Path relative to the consumer repo root. May be a file or directory. */
  relPath: string;
}

function collectBackupTargets(root: string, sourceRoot?: string): BackupTarget[] {
  const set = new Set<string>();

  // Package-mirrored paths: trust the sync iterator so backup matches sync.
  if (sourceRoot) {
    for (const entry of iterArsOwnedFiles(sourceRoot)) {
      set.add(entry.relPath);
    }
  }

  // Plugin-derived paths under consumer repo. These never live in the package
  // mirror (they come from plugin/ and land in .claude/, .ars/hooks/), so they
  // are added explicitly as directories.
  for (const dir of PLUGIN_DERIVED_BACKUP_DIRS) set.add(dir);

  // Each plugin skill lives at `.claude/skills/ars:<name>/`, listed
  // dynamically since the names follow whatever skills are installed.
  const claudeSkillsBase = path.join(root, '.claude', 'skills');
  if (fs.existsSync(claudeSkillsBase)) {
    for (const dirent of fs.readdirSync(claudeSkillsBase, { withFileTypes: true })) {
      if (dirent.isDirectory() && dirent.name.startsWith('ars:')) {
        set.add(`.claude/skills/${dirent.name}`);
      }
    }
  }

  return Array.from(set).sort().map((relPath) => ({ relPath }));
}

/**
 * @deprecated Use {@link backupArsAssets} with the new signature. Kept as a
 * thin alias so any downstream caller still importing backupEngine keeps
 * working. Note the return value (engine snapshot dir) is now derived from
 * the manifest-based timestamp directory.
 */
export function backupEngine(root = getTargetRepoRoot()): string {
  const backup = backupArsAssets({ root });
  return path.join(backup.timestampDir, 'snapshot', 'src', 'engine');
}

const ENGINE_BACKUP_RETENTION_COUNT = 3;

function pruneOldArsAssetBackups(backupsRoot: string): void {
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
 * Copy ARS plugin skills into the repo's .claude/skills/ars:<name>/ directories so that
 * Claude Code can discover them without requiring --plugin-dir at launch time.
 *
 * Each skill lives at plugin/skills/<name>/SKILL.md and is copied to
 * .claude/skills/ars:<name>/SKILL.md in the target repo.
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
    const sourceSkillDir = path.join(sourceSkillsDir, name);
    const sourceSkillMd = path.join(sourceSkillDir, 'SKILL.md');
    if (!fs.existsSync(sourceSkillMd)) continue;

    // Skill name becomes "ars:<name>" so it's invoked as /ars:<name>
    const targetSkillDir = path.join(targetSkillsBaseDir, `ars:${name}`);
    const targetSkillMd = path.join(targetSkillDir, 'SKILL.md');
    if (fs.existsSync(targetSkillMd) && !overwrite) continue;

    // Copy the whole skill directory (SKILL.md + references/, scripts/, etc.)
    copyDirectory(sourceSkillDir, targetSkillDir, { overwrite });
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
  // When overwrite is true, hand the whole directory to fs.cpSync in one shot
  // (force: true replaces existing files and writes new ones in one call).
  if (overwrite || !fs.existsSync(targetPath)) {
    copyDirectory(sourcePath, targetPath, { overwrite });
    copied.push(`${label} ← ${sourcePath}`);
    return;
  }
  // Target directory already exists and we're not overwriting. Still walk the
  // source tree to land NEW files that don't exist at the target yet — this
  // is the path that keeps `npx ars init` from clobbering user edits while
  // still picking up newly-added ARS files on subsequent installs.
  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const nextSource = path.join(sourcePath, entry.name);
    const nextTarget = path.join(targetPath, entry.name);
    const nextLabel = `${label}${entry.name}${entry.isDirectory() ? '/' : ''}`;
    if (entry.isDirectory()) {
      syncDirectoryIfNeeded(nextSource, nextTarget, overwrite, nextLabel, copied);
    } else if (entry.isFile()) {
      syncFileIfNeeded(nextSource, nextTarget, overwrite, nextLabel, copied);
    }
  }
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
  pluginRoot?: string;
}): void {
  const { root, pluginRoot } = options;
  const settingsPath = path.join(root, '.claude', 'settings.json');
  const statusLineConfigPath = path.join(root, '.ars', 'hooks', 'ars-statusline-config.json');
  const statusLineCommand = 'node ".ars/hooks/scripts/ars-statusline.mjs"';

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
          { type: 'command', command: 'node ".ars/hooks/scripts/studio-intent-stop.mjs"', timeout: 3 },
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

  let statusLineConfig: Record<string, unknown> = {};
  if (fs.existsSync(statusLineConfigPath)) {
    try {
      statusLineConfig = JSON.parse(fs.readFileSync(statusLineConfigPath, 'utf-8')) as Record<string, unknown>;
    } catch { /* start fresh */ }
  }

  // ARS hook command fingerprint — used to detect existing ARS entries
  const ARS_HOOK_MARKER = '.ars/hooks/scripts/';
  const existingStatusLine =
    typeof settings.statusLine === 'object' && settings.statusLine !== null
      ? settings.statusLine as Record<string, unknown>
      : undefined;
  const existingCommand =
    typeof existingStatusLine?.command === 'string' ? existingStatusLine.command.trim() : '';
  const delegateCommand = existingCommand && existingCommand !== statusLineCommand
    ? existingCommand
    : typeof statusLineConfig.delegate === 'string'
      ? statusLineConfig.delegate
      : '';

  fs.mkdirSync(path.dirname(statusLineConfigPath), { recursive: true });
  fs.writeFileSync(
    statusLineConfigPath,
    `${JSON.stringify({
      ...statusLineConfig,
      delegate: delegateCommand,
      arsVersion: pluginRoot ? (readPluginVersionFromRoot(pluginRoot) ?? '') : '',
    }, null, 2)}\n`,
    'utf-8',
  );
  settings.statusLine = { type: 'command', command: statusLineCommand };

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

  // Pre-allow common ARS commands so onboard/plan/build don't prompt every step.
  // Users can revoke any entry from .claude/settings.json after install.
  const arsAllow = [
    'Bash(npx ars *)',
    'Bash(ars *)',
    'Bash(node .ars/hooks/scripts/*)',
    'Bash(ls *)',
    'Bash(cat *)',
    'Bash(pwd)',
    'Bash(test *)',
    'Bash(mkdir *)',
    'Bash(rm *)',
    'Bash(mv *)',
    'Bash(cp *)',
    'Bash(echo *)',
    'Bash(grep *)',
    'Bash(find *)',
    'Bash(head *)',
    'Bash(tail *)',
    'Bash(wc *)',
    'Bash(diff *)',
    'Bash(jq *)',
    'Bash(python3 *)',
  ];
  const existingPermissions =
    typeof settings.permissions === 'object' && settings.permissions !== null
      ? (settings.permissions as Record<string, unknown>)
      : {};
  const existingAllow = Array.isArray(existingPermissions.allow)
    ? (existingPermissions.allow as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const mergedAllow = Array.from(new Set([...existingAllow, ...arsAllow]));
  settings.permissions = {
    ...existingPermissions,
    allow: mergedAllow,
  };

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
}

function readPluginVersionFromRoot(pluginRoot: string): string | null {
  for (const dir of [pluginRoot, path.dirname(pluginRoot)]) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { version?: unknown };
      if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
    } catch { /* try next */ }
  }
  return null;
}
