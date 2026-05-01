/**
 * @command rollback
 * @description Restore the most recent (or selected) ARS update backup.
 *
 * Cross-platform replacement for the unix-only `rm -rf` / `cp -R` rollback
 * hints that update used to print. Reads the manifest written by
 * backupArsAssets and applies the snapshot via Node fs APIs only — no shell.
 */
import fs from 'fs';
import path from 'path';
import { getArsDir, getRepoRoot } from '../lib/ars-config';
import {
  BackupEntry,
  BackupManifest,
  readManifest,
} from '../lib/backup-manifest';

const HELP = `
Usage: npx ars rollback [options]

Restore a backup created by \`npx ars update\`. By default rolls back the most
recent timestamp under .ars/backups/. Cross-platform — uses Node fs APIs, no
shell commands.

Options:
  --list          List available backups (newest first) and exit
  --to <ts>       Roll back to a specific backup timestamp
  --dry-run       Print what would be restored without changing anything
  -q, --quiet     Suppress non-error output
  -h, --help      Show this help
`;

interface RollbackOptions {
  list: boolean;
  to?: string;
  dryRun: boolean;
  quiet: boolean;
}

export async function run(args: string[]): Promise<void> {
  const options = parseOptions(args);

  if (options.list) {
    listBackups();
    return;
  }

  const repoRoot = getRepoRoot();
  const backupsRoot = path.join(getArsDir(repoRoot), 'backups');

  const targetTimestamp = options.to ?? findLatestBackup(backupsRoot);
  if (!targetTimestamp) {
    console.error('❌ No backups found at .ars/backups/.');
    console.error('   Run `npx ars update` first to create a backup, or pass --to <ts> with a known timestamp.');
    process.exit(1);
  }

  const timestampDir = path.join(backupsRoot, targetTimestamp);
  if (!fs.existsSync(timestampDir)) {
    console.error(`❌ Backup not found: ${timestampDir}`);
    console.error('   Use `npx ars rollback --list` to see available timestamps.');
    process.exit(1);
  }

  const manifest = readManifest(timestampDir);
  rollbackToManifest(repoRoot, timestampDir, manifest, options);
}

function rollbackToManifest(
  repoRoot: string,
  timestampDir: string,
  manifest: BackupManifest,
  options: RollbackOptions,
): void {
  const lines: string[] = [];
  lines.push(`Restoring ${manifest.entries.length} path(s) from ${timestampDir}`);
  if (manifest.createdAt) lines.push(`  created: ${manifest.createdAt}`);

  if (options.dryRun) {
    lines.push('  (dry run — no files will be changed)');
  }

  if (!options.quiet) {
    for (const line of lines) console.log(line);
  }

  for (const entry of manifest.entries) {
    const targetAbs = path.join(repoRoot, entry.targetRelPath);
    const snapshotAbs = path.join(timestampDir, entry.snapshotRelPath);

    if (!fs.existsSync(snapshotAbs)) {
      console.error(`⚠️  Snapshot missing for ${entry.targetRelPath} at ${snapshotAbs}; skipping.`);
      continue;
    }

    if (options.dryRun) {
      if (!options.quiet) console.log(`  - would restore ${entry.targetRelPath}`);
      continue;
    }

    restoreEntry(targetAbs, snapshotAbs, entry);
    if (!options.quiet) console.log(`  ✓ restored ${entry.targetRelPath}`);
  }

  // Special-case: clean up stale ars:* skill siblings under .claude/skills/
  // that exist now but were not in the snapshot. Otherwise rolling back from
  // a state with skills X+Y to a state that only had X would leave Y behind.
  if (!options.dryRun) {
    cleanupStaleArsSkills(repoRoot, manifest);
  }

  if (!options.quiet) {
    console.log('');
    console.log(options.dryRun
      ? 'Dry run complete. Re-run without --dry-run to apply.'
      : '✅ Rollback complete.');
  }
}

function restoreEntry(targetAbs: string, snapshotAbs: string, entry: BackupEntry): void {
  if (fs.existsSync(targetAbs)) {
    fs.rmSync(targetAbs, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  if (entry.kind === 'directory') {
    fs.cpSync(snapshotAbs, targetAbs, { recursive: true, force: true });
  } else {
    fs.copyFileSync(snapshotAbs, targetAbs);
  }
}

/**
 * Plugin skills land under `.claude/skills/ars:<name>/`. If the current repo
 * has more `ars:*` siblings than the snapshot did (e.g. a newer update
 * synced an additional skill that the user wants to roll back), remove them
 * so the post-rollback state matches the snapshot exactly.
 */
function cleanupStaleArsSkills(repoRoot: string, manifest: BackupManifest): void {
  const claudeSkillsBase = path.join(repoRoot, '.claude', 'skills');
  if (!fs.existsSync(claudeSkillsBase)) return;

  const snapshotSkills = new Set(
    manifest.entries
      .map((entry) => entry.targetRelPath)
      .filter((p) => p.startsWith('.claude/skills/ars:'))
      .map((p) => p.split('/')[2]),
  );

  for (const dirent of fs.readdirSync(claudeSkillsBase, { withFileTypes: true })) {
    if (!dirent.isDirectory() || !dirent.name.startsWith('ars:')) continue;
    if (snapshotSkills.has(dirent.name)) continue;
    fs.rmSync(path.join(claudeSkillsBase, dirent.name), { recursive: true, force: true });
  }
}

function listBackups(): void {
  const backupsRoot = path.join(getArsDir(getRepoRoot()), 'backups');
  if (!fs.existsSync(backupsRoot)) {
    console.log('No backups found at .ars/backups/.');
    return;
  }

  const dirs = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.log('No backups found at .ars/backups/.');
    return;
  }

  console.log(`Backups at ${backupsRoot} (newest first):`);
  for (const ts of dirs) {
    const manifestPath = path.join(backupsRoot, ts, 'manifest.json');
    let info = '(no manifest — older snapshot)';
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = readManifest(path.join(backupsRoot, ts));
        info = `${manifest.entries.length} path(s) from ${manifest.source}`;
      } catch (err) {
        info = `(unreadable manifest: ${(err as Error).message.split('\n')[0]})`;
      }
    }
    console.log(`  ${ts}  ${info}`);
  }
  console.log('');
  console.log('Use `npx ars rollback --to <timestamp>` to roll back to a specific backup.');
}

function findLatestBackup(backupsRoot: string): string | undefined {
  if (!fs.existsSync(backupsRoot)) return undefined;
  const dirs = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.pop();
}

function parseOptions(args: string[]): RollbackOptions {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const toIdx = args.indexOf('--to');
  const to = toIdx !== -1 ? args[toIdx + 1] : undefined;
  if (toIdx !== -1 && !to) {
    console.error('Error: --to <timestamp> requires a value');
    process.exit(1);
  }

  return {
    list: args.includes('--list'),
    to,
    dryRun: args.includes('--dry-run'),
    quiet: args.includes('--quiet') || args.includes('-q'),
  };
}
