import path from 'path';
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

Backs up src/engine into .ars/backups/<timestamp>/engine, keeps the latest 3 backups, and refreshes it from the installed ARS package.

Options:
  --force            Refresh engine, CLAUDE.md, and version metadata
  --force-engine     Refresh engine and version metadata
  --force-claude-md  Rebuild the ARS block in CLAUDE.md
  -q, --quiet        Suppress non-error output
`;

export interface UpdateOptions {
  force: boolean;
  forceEngine: boolean;
  forceClaudeMd: boolean;
  quiet: boolean;
}

export async function run(args: string[]) {
  const options = parseOptions(args);
  const result = await updateCommand(options);

  if (options.quiet) {
    return;
  }

  console.log(`✅ Backed up engine to ${result.backup.engineDir}`);
  if (result.backup.claudeSkillsDir) {
    console.log(`✅ Backed up ARS skills to ${result.backup.claudeSkillsDir}`);
  }
  if (result.backup.claudeAgentsDir) {
    console.log(`✅ Backed up ARS agents to ${result.backup.claudeAgentsDir}`);
  }
  if (result.backup.hookScriptsDir) {
    console.log(`✅ Backed up hook scripts to ${result.backup.hookScriptsDir}`);
  }
  console.log(`✅ Refreshed engine from ${path.join(result.sourceRoot, 'src', 'engine')}`);
  if (result.installedSkills.length > 0) {
    console.log(`✅ Synced ${result.installedSkills.length} ARS skills into .claude/skills/ars/`);
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

  // Make non-snapshotted overwrites visible. syncEngineFiles refreshes a long
  // list of ARS-owned support files (vite.studio.config.ts, tsconfig.json,
  // eslint.config.mjs, src/studio/**, .github/workflows/ci.yml, etc.) that
  // backupArsAssets does NOT cover. Without this banner the user has no way
  // to know which paths to inspect with `git diff` when something feels off.
  const supportFiles = summarizeSupportFiles(result.supportFilesTouched);
  if (supportFiles.length > 0) {
    console.log('');
    console.log('ℹ️  Refreshed ARS-owned support files (NOT in the backup above — review with `git diff` if customised):');
    for (const entry of supportFiles) {
      console.log(`     - ${entry}`);
    }
  }

  console.log('');
  console.log('Rollback hints (snapshotted assets):');
  console.log(`  rm -rf "${path.join(result.root, 'src', 'engine')}"`);
  console.log(`  cp -R "${result.backup.engineDir}" "${path.join(result.root, 'src', 'engine')}"`);
  if (result.backup.claudeSkillsDir) {
    // The snapshot contains one or more `ars:<name>/` subdirectories. Restore
    // them in place under the consumer repo's .claude/skills/ — wipe any
    // existing `ars:*` siblings first so the user gets exactly the snapshotted
    // set, not a merge with whatever update just synced.
    const target = path.join(result.root, '.claude', 'skills');
    console.log(`  find "${target}" -maxdepth 1 -type d -name 'ars:*' -exec rm -rf {} +`);
    console.log(`  cp -R "${result.backup.claudeSkillsDir}/." "${target}/"`);
  }
  if (result.backup.claudeAgentsDir) {
    const target = path.join(result.root, '.claude', 'agents');
    console.log(`  rm -rf "${target}"`);
    console.log(`  cp -R "${result.backup.claudeAgentsDir}" "${target}"`);
  }
  if (result.backup.hookScriptsDir) {
    const target = path.join(result.root, '.ars', 'hooks', 'scripts');
    console.log(`  rm -rf "${target}"`);
    console.log(`  cp -R "${result.backup.hookScriptsDir}" "${target}"`);
  }
  if (supportFiles.length > 0) {
    console.log('Support files above are NOT snapshotted — recover via `git restore <path>` or `git checkout <ref> -- <path>`.');
  }
}

/**
 * Reduce the verbose `syncEngineFiles` copy log into a short list of paths the
 * user might have customised. `engine/` and `episodes/template/` are excluded
 * because they're either covered by the engine backup or shipped read-only.
 */
function summarizeSupportFiles(copiedFiles: string[]): string[] {
  const labels = new Set<string>();
  for (const entry of copiedFiles) {
    // Each entry is either "<label> ← <source>" (from syncEngineFiles) or a
    // bare label (e.g. "package.json (generated)", ".gitignore"). Take only
    // the label half so the output stays readable.
    const label = entry.split(' ← ')[0].trim();
    if (!label) continue;
    if (label.startsWith('engine/')) continue; // covered by the engine backup
    if (label.startsWith('episodes/template/')) continue; // ARS-shipped read-only template
    labels.add(label);
  }
  return Array.from(labels).sort();
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
  /** Raw copy log from syncEngineFiles for surfacing non-snapshotted overwrites. */
  supportFilesTouched: string[];
  stateMigration: StateMigrationResult;
}> {
  const root = options.root ?? getTargetRepoRoot();
  const runtime = getRuntimePackageInfo(import.meta.url);
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  // Snapshot every ARS-owned asset BEFORE any sync runs. `.claude/` is in the
  // consumer-repo .gitignore, so without this backup `git restore` cannot
  // recover user customizations to `.claude/skills/ars/` or `.claude/agents/`.
  const backup = backupArsAssets(root);

  const supportFilesTouched = syncEngineFiles({
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
    supportFilesTouched,
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
  };
}
