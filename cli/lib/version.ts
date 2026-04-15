import fs from 'fs';
import path from 'path';

export type ArsInstallMethod = 'npm-local' | 'npm-global' | 'source';

export interface ArsVersionMetadata {
  version: string;
  installedAt: string;
  lastUpdatedAt?: string;
  installMethod: ArsInstallMethod;
  sourceCommit?: string;
  sourcePath?: string;
  pluginVersion?: string;
  engineSource?: string;
  configSchemaVersion: number;
}

interface LegacyEngineVersionRecord {
  commit?: unknown;
  copiedAt?: unknown;
  source?: unknown;
}

export function getVersionFilePath(root = process.cwd()): string {
  return path.join(root, '.ars', '.ars-version.json');
}

export function getLegacyEngineVersionPath(root = process.cwd()): string {
  return path.join(root, '.ars', 'engine-version.json');
}

export function readInstalledVersion(root = process.cwd()): ArsVersionMetadata | null {
  const versionPath = getVersionFilePath(root);
  if (fs.existsSync(versionPath)) {
    return parseVersionMetadata(fs.readFileSync(versionPath, 'utf-8'));
  }

  const legacyPath = getLegacyEngineVersionPath(root);
  if (!fs.existsSync(legacyPath)) {
    return null;
  }

  return readLegacyEngineVersion(legacyPath);
}

export function writeInstalledVersion(
  metadata: ArsVersionMetadata,
  root = process.cwd(),
): string {
  const outputPath = getVersionFilePath(root);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
  return outputPath;
}

export function compareVersions(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);

  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] < b.core[index]) return -1;
    if (a.core[index] > b.core[index]) return 1;
  }

  const aHasPrerelease = a.prerelease.length > 0;
  const bHasPrerelease = b.prerelease.length > 0;

  if (!aHasPrerelease && !bHasPrerelease) return 0;
  if (!aHasPrerelease) return 1;
  if (!bHasPrerelease) return -1;

  const maxLength = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];

    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;

    const aNumber = Number(aPart);
    const bNumber = Number(bPart);
    const aNumeric = Number.isInteger(aNumber) && `${aNumber}` === aPart;
    const bNumeric = Number.isInteger(bNumber) && `${bNumber}` === bPart;

    if (aNumeric && bNumeric) {
      if (aNumber < bNumber) return -1;
      if (aNumber > bNumber) return 1;
      continue;
    }

    if (aNumeric) return -1;
    if (bNumeric) return 1;

    if (aPart < bPart) return -1;
    if (aPart > bPart) return 1;
  }

  return 0;
}

export function assertNoDowngrade(
  currentVersion: string | null,
  targetVersion: string,
): void {
  if (!currentVersion) {
    return;
  }

  if (compareVersions(currentVersion, targetVersion) > 0) {
    throw new Error(
      `Refusing to downgrade ARS from ${currentVersion} to ${targetVersion}. Install a newer CLI package instead.`,
    );
  }
}

export function hasVersionDrift(
  installedVersion: string | null,
  runtimeVersion: string,
): boolean {
  return !!installedVersion && installedVersion !== runtimeVersion;
}

function parseVersionMetadata(raw: string): ArsVersionMetadata {
  const parsed = JSON.parse(raw) as Partial<ArsVersionMetadata>;
  if (!parsed.version || typeof parsed.version !== 'string') {
    throw new Error('Invalid .ars/.ars-version.json: missing "version".');
  }
  if (!parsed.installedAt || typeof parsed.installedAt !== 'string') {
    throw new Error('Invalid .ars/.ars-version.json: missing "installedAt".');
  }
  if (!parsed.installMethod || typeof parsed.installMethod !== 'string') {
    throw new Error('Invalid .ars/.ars-version.json: missing "installMethod".');
  }
  if (
    parsed.configSchemaVersion === undefined ||
    typeof parsed.configSchemaVersion !== 'number'
  ) {
    throw new Error(
      'Invalid .ars/.ars-version.json: missing "configSchemaVersion".',
    );
  }

  return parsed as ArsVersionMetadata;
}

function readLegacyEngineVersion(filePath: string): ArsVersionMetadata | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(filePath, 'utf-8'),
    ) as LegacyEngineVersionRecord;
    const sourceCommit =
      typeof parsed.commit === 'string' ? parsed.commit : undefined;
    const copiedAt =
      typeof parsed.copiedAt === 'string' ? parsed.copiedAt : new Date().toISOString();
    const sourcePath =
      typeof parsed.source === 'string' ? parsed.source : undefined;
    const derivedVersion = sourceCommit?.startsWith('version:')
      ? sourceCommit.slice('version:'.length)
      : undefined;

    return {
      version: derivedVersion ?? 'unknown',
      installedAt: copiedAt,
      lastUpdatedAt: copiedAt,
      installMethod: sourcePath?.includes('node_modules') ? 'npm-local' : 'source',
      sourceCommit,
      sourcePath,
      engineSource: 'src/engine',
      configSchemaVersion: 1,
    };
  } catch {
    return null;
  }
}

function parseSemver(version: string): {
  core: [number, number, number];
  prerelease: string[];
} {
  const cleaned = version.trim().replace(/^v/, '');
  const [main, prereleaseRaw] = cleaned.split('-', 2);
  const mainParts = main
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);

  while (mainParts.length < 3) {
    mainParts.push(0);
  }

  return {
    core: mainParts as [number, number, number],
    prerelease: prereleaseRaw ? prereleaseRaw.split('.') : [],
  };
}
