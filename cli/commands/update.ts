import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { CONFIG_SCHEMA_VERSION } from '../lib/ars-config';
import {
  ArsAssetBackup,
  backupArsAssets,
  detectInstallMethod,
  getTargetRepoRoot,
  locateSourcePackageRoot,
  patchClaudeMd,
  patchClaudeSettings,
  syncAgents,
  syncEngineFiles,
  syncHookScripts,
  syncSkills,
  writeVersionMetadata,
} from '../lib/install';
import { getRuntimePackageInfo } from '../lib/runtime-package';
import { migrateArsState, type StateMigrationResult } from '../lib/state-migrations';

const HELP = `
Usage: npx ars update [options]

Snapshots every ARS-owned file into .ars/backups/<timestamp>/snapshot/, writes
a manifest, and refreshes the engine and plugin assets from the installed
package. The latest 3 backups are kept.

Use \`npx ars rollback\` to revert.

Options:
  --force            Refresh engine, CLAUDE.md, and version metadata
  --force-engine     Refresh engine and version metadata
  --force-claude-md  Rebuild the ARS block in CLAUDE.md
  --no-pull          Skip the git pull on the linked ARS source repo
  -q, --quiet        Suppress non-error output
`;

export interface UpdateOptions {
  force: boolean;
  forceEngine: boolean;
  forceClaudeMd: boolean;
  quiet: boolean;
  pull: boolean;
}

export async function run(args: string[]) {
  const options = parseOptions(args);
  const result = await updateCommand(options);

  if (options.quiet) {
    return;
  }

  console.log(`✅ Snapshotted ${result.backup.entryCount} ARS-owned paths to ${result.backup.timestampDir}`);
  console.log(`✅ Refreshed engine from ${path.join(result.sourceRoot, 'src', 'engine')}`);
  if (result.installedSkills.length > 0) {
    console.log(`✅ Synced ${result.installedSkills.length} ARS skills into .claude/skills/`);
  }
  if (result.installedAgents.length > 0) {
    console.log(`✅ Synced ${result.installedAgents.length} ARS agents into .claude/agents/`);
  }
  if (result.installedHookScripts.length > 0) {
    console.log(`✅ Synced ${result.installedHookScripts.length} hook scripts into .ars/hooks/scripts/`);
  }
  if (result.claudeMdPath) {
    console.log(`✅ Patched ${result.claudeMdPath}`);
  }
  console.log(`✅ Wrote ${result.versionPath}`);
  if (result.stateMigration.prepareIntentsNormalized > 0 || result.stateMigration.prepareIntentsResolved > 0) {
    console.log(
      `✅ Migrated ARS state (${result.stateMigration.prepareIntentsNormalized} prepare intent kind(s) normalized, ${result.stateMigration.prepareIntentsResolved} satisfied prepare intent(s) resolved)`,
    );
  }
  console.log('');
  console.log('To revert: npx ars rollback');
}

export async function updateCommand(options: UpdateOptions & { root?: string }):
Promise<{
  root: string;
  sourceRoot: string;
  backup: ArsAssetBackup;
  versionPath: string;
  claudeMdPath?: string;
  installedSkills: string[];
  installedAgents: string[];
  installedHookScripts: string[];
  stateMigration: StateMigrationResult;
}> {
  const root = options.root ?? getTargetRepoRoot();
  const runtime = getRuntimePackageInfo(import.meta.url);
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  if (options.pull) {
    pullSourceRepo(sourceRoot, options.quiet);
  }
  // Snapshot every ARS-owned asset BEFORE any sync runs. backupArsAssets uses
  // the SAME iterator (iterArsOwnedFiles) that syncEngineFiles uses, so the
  // backup-range and sync-range cannot drift apart. The manifest written into
  // the timestamp dir lets `npx ars rollback` restore the snapshot without
  // any platform-specific shell commands.
  const backup = backupArsAssets({ root, sourceRoot });

  syncEngineFiles({
    root,
    sourceRoot,
    overwriteEngine: true,
    // Support files (src/studio-main.tsx, src/studio/**, vite.studio.config.ts,
    // tsconfig.json, etc.) are ARS-owned. `update` always refreshes them —
    // otherwise adding a new top-level file in src/ silently fails to land in
    // consumer repos and StudioShell / studio-main signatures drift apart.
    overwriteSupportFiles: true,
  });

  const installedSkills = syncSkills({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
  const installedAgents = syncAgents({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
  const installedHookScripts = syncHookScripts({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
  patchClaudeSettings({ root, pluginRoot: runtime.pluginRoot });

  const claudeMdPath =
    options.force || options.forceClaudeMd ? patchClaudeMd(root) : undefined;
  const versionPath = writeVersionMetadata({
    root,
    sourceRoot,
    runtimeVersion: runtime.version,
    pluginVersion: runtime.version,
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    installMethod: detectInstallMethod(sourceRoot),
  });
  const stateMigration = await migrateArsState(root);

  return {
    root,
    sourceRoot,
    backup,
    versionPath,
    claudeMdPath,
    installedSkills,
    installedAgents,
    installedHookScripts,
    stateMigration,
  };
}

function parseOptions(args: string[]): UpdateOptions {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  return {
    force: args.includes('--force'),
    forceEngine: args.includes('--force-engine'),
    forceClaudeMd: args.includes('--force-claude-md'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    pull: !args.includes('--no-pull'),
  };
}

function pullSourceRepo(sourceRoot: string, quiet: boolean): void {
  if (!fs.existsSync(path.join(sourceRoot, '.git'))) {
    if (!quiet) {
      console.log(`ℹ️  Skipping git pull: ${sourceRoot} is not a git repo.`);
    }
    return;
  }

  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: sourceRoot,
    encoding: 'utf-8',
  });
  if (status.status !== 0) {
    console.warn(`⚠️  Skipping git pull: failed to read git status in ${sourceRoot}.`);
    return;
  }
  if (status.stdout.trim().length > 0) {
    console.warn(
      `⚠️  Skipping git pull: ${sourceRoot} has uncommitted changes. ` +
        'Commit or stash them, or rerun with --no-pull.',
    );
    return;
  }

  if (!quiet) {
    console.log(`⏬ Pulling latest ARS source in ${sourceRoot}...`);
  }
  const pull = spawnSync('git', ['pull', '--ff-only'], {
    cwd: sourceRoot,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf-8',
  });
  if (pull.status !== 0) {
    console.warn(
      `⚠️  git pull failed in ${sourceRoot}. Continuing with current source. ` +
        'Run `git pull` manually and re-run `ars update` to get the newest version.',
    );
  }
}
