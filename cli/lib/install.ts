import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getArsDir } from './ars-config';

const PACKAGE_NAME = 'agentic-remotion-studio';
const ENGINE_VERSION_FILE = 'engine-version.json';
const ARS_MARKER_BEGIN = '<!-- ars:begin -->';
const ARS_MARKER_END = '<!-- ars:end -->';
const ARS_COMMANDS_BLOCK = `${ARS_MARKER_BEGIN}
## ARS Commands
- \`/ars:setup\`：初始化 ARS，建立設定並安裝/同步 engine 檔案
- \`/ars:doctor\`：檢查 ARS 設定、engine 安裝狀態與 provider 憑證
- \`/ars:scene-plan\`：產生場景規劃 artifact，先定義每個 step 的內容與結構
- \`/ars:scene-build\`：依 scene plan 實作 step 內容，不自由發明額外結構
- \`/ars:scene-fix\`：根據最新 review intent 或指定 intent 修正單一場景
- \`/ars:prepare-youtube\`：整理 YouTube metadata 與發布前檢查
- \`/ars:publish-youtube\`：在人工確認後執行 YouTube 發布流程
${ARS_MARKER_END}`;

interface PackageJsonLike {
  name?: unknown;
  gitHead?: unknown;
}

export interface EngineVersionRecord {
  commit: string;
  copiedAt: string;
  source: string;
}

export function getTargetRepoRoot(): string {
  return process.cwd();
}

export function getEngineVersionPath(root = getTargetRepoRoot()): string {
  return path.join(getArsDir(root), ENGINE_VERSION_FILE);
}

export function writeEngineVersion(
  record: EngineVersionRecord,
  root = getTargetRepoRoot(),
): string {
  const outputPath = getEngineVersionPath(root);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
  return outputPath;
}

export function locateSourcePackageRoot(importMetaUrl: string): string {
  const startDir = path.dirname(fileURLToPath(importMetaUrl));
  let currentDir = startDir;
  let fallbackRoot: string | null = null;

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = readPackageJson(packageJsonPath);
      if (pkg.name === PACKAGE_NAME) {
        return currentDir;
      }

      if (!fallbackRoot && hasArsSourceLayout(currentDir)) {
        fallbackRoot = currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  if (fallbackRoot) {
    return fallbackRoot;
  }

  throw new Error(
    `Could not locate ${PACKAGE_NAME} package root from ${startDir}.`,
  );
}

export function isArsDevelopmentRepo(
  targetRoot: string,
  sourceRoot: string,
): boolean {
  if (isSamePath(targetRoot, sourceRoot)) {
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
  const pkg = fs.existsSync(packageJsonPath)
    ? readPackageJson(packageJsonPath)
    : null;
  if (typeof pkg?.gitHead === 'string' && pkg.gitHead.trim()) {
    return pkg.gitHead.trim();
  }

  if (typeof pkg?.version === 'string' && pkg.version.trim()) {
    return `version:${pkg.version.trim()}`;
  }

  throw new Error(
    `Failed to resolve source commit from ${sourceRoot}: ${
      gitResult.stderr.trim() || 'git rev-parse HEAD failed'
    }`,
  );
}

function hasArsSourceLayout(root: string): boolean {
  return (
    fs.existsSync(path.join(root, 'plugin')) &&
    fs.existsSync(path.join(root, 'src', 'engine'))
  );
}

function readPackageName(root: string): string | null {
  const packageJsonPath = path.join(root, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const pkg = readPackageJson(packageJsonPath);
  return typeof pkg.name === 'string' ? pkg.name : null;
}

function readPackageJson(packageJsonPath: string): PackageJsonLike {
  return JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8'),
  ) as PackageJsonLike;
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}
