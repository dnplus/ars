/**
 * @module cli/lib/backup-manifest
 *
 * Schema and helpers for `<backupsRoot>/<timestamp>/manifest.json`.
 *
 * Each `npx ars update` run creates one timestamp directory under
 * `.ars/backups/`. The manifest records every snapshot the run captured so
 * that `npx ars rollback` can restore them without hard-coding paths or
 * relying on platform-specific shell commands. Two design goals:
 *
 *   1. Cross-platform: rollback must work on macOS / Linux / Windows. Manifest
 *      is JSON; rollback uses Node `fs.cpSync` / `fs.rmSync`. No shell.
 *   2. Forward compatibility: every entry carries enough info (target path,
 *      kind: directory|file, plus a top-level schemaVersion) that an older
 *      rollback can refuse cleanly when it sees a manifest it doesn't
 *      understand instead of corrupting state.
 */
import fs from 'fs';
import path from 'path';

export const BACKUP_MANIFEST_SCHEMA_VERSION = 1;
export const BACKUP_MANIFEST_FILENAME = 'manifest.json';

export type BackupEntryKind = 'file' | 'directory';

export interface BackupEntry {
  /** Path RELATIVE to the consumer repo root that this snapshot came from. */
  targetRelPath: string;
  /** Path RELATIVE to the timestamp dir where the snapshot lives. */
  snapshotRelPath: string;
  /** Whether the original target was a file or a directory. */
  kind: BackupEntryKind;
}

export interface BackupManifest {
  schemaVersion: number;
  createdAt: string;
  /** Origin of the backup, useful for debugging which command captured it. */
  source: 'update' | 'init' | 'manual';
  /** Repo root at backup time (absolute), informational only. */
  repoRoot: string;
  /** Snapshot entries — restoring them in order brings the repo back to pre-update state. */
  entries: BackupEntry[];
}

export function getManifestPath(timestampDir: string): string {
  return path.join(timestampDir, BACKUP_MANIFEST_FILENAME);
}

export function writeManifest(timestampDir: string, manifest: BackupManifest): void {
  fs.mkdirSync(timestampDir, { recursive: true });
  fs.writeFileSync(
    getManifestPath(timestampDir),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8',
  );
}

export function readManifest(timestampDir: string): BackupManifest {
  const manifestPath = getManifestPath(timestampDir);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Backup manifest not found at ${manifestPath}. This backup was either created by an older ARS version (no manifest support) or has been corrupted; rollback cannot proceed automatically.`,
    );
  }

  const raw = fs.readFileSync(manifestPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Backup manifest at ${manifestPath} is not valid JSON: ${(cause as Error).message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Backup manifest at ${manifestPath} must be a JSON object.`);
  }

  const schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0;
  if (schemaVersion > BACKUP_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Backup manifest at ${manifestPath} reports schemaVersion=${schemaVersion}, but this CLI only knows up to ${BACKUP_MANIFEST_SCHEMA_VERSION}. Upgrade ARS before rolling back this backup.`,
    );
  }
  if (schemaVersion < 1) {
    throw new Error(
      `Backup manifest at ${manifestPath} is missing a schemaVersion. This is likely an older snapshot; rollback cannot proceed automatically.`,
    );
  }

  const entriesRaw = parsed.entries;
  if (!Array.isArray(entriesRaw)) {
    throw new Error(`Backup manifest at ${manifestPath} must have an "entries" array.`);
  }

  const entries: BackupEntry[] = entriesRaw.map((entry, idx) => {
    if (!isRecord(entry)) {
      throw new Error(`Backup manifest entry #${idx} at ${manifestPath} must be an object.`);
    }
    const target = entry.targetRelPath;
    const snapshot = entry.snapshotRelPath;
    const kind = entry.kind;
    if (typeof target !== 'string' || !target) {
      throw new Error(`Backup manifest entry #${idx} is missing targetRelPath.`);
    }
    if (typeof snapshot !== 'string' || !snapshot) {
      throw new Error(`Backup manifest entry #${idx} is missing snapshotRelPath.`);
    }
    if (kind !== 'file' && kind !== 'directory') {
      throw new Error(`Backup manifest entry #${idx} has invalid kind: ${String(kind)}`);
    }
    return { targetRelPath: target, snapshotRelPath: snapshot, kind };
  });

  return {
    schemaVersion,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
    source: (parsed.source === 'init' || parsed.source === 'manual' ? parsed.source : 'update'),
    repoRoot: typeof parsed.repoRoot === 'string' ? parsed.repoRoot : '',
    entries,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
