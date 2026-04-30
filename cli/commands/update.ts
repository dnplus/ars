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
  console.log('Rollback hints:');
  console.log(`  rm -rf "${path.join(result.root, 'src', 'engine')}"`);
  console.log(`  cp -R "${result.backup.engineDir}" "${path.join(result.root, 'src', 'engine')}"`);
  if (result.backup.claudeSkillsDir) {
    const target = path.join(result.root, '.claude', 'skills', 'ars');
    console.log(`  rm -rf "${target}"`);
    console.log(`  cp -R "${result.backup.claudeSkillsDir}" "${target}"`);
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
}> {
  const root = options.root ?? getTargetRepoRoot();
  const runtime = getRuntimePackageInfo(import.meta.url);
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  // Snapshot every ARS-owned asset BEFORE any sync runs. `.claude/` is in the
  // consumer-repo .gitignore, so without this backup `git restore` cannot
  // recover user customizations to `.claude/skills/ars/` or `.claude/agents/`.
  const backup = backupArsAssets(root);

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

  return {
    root,
    sourceRoot,
    backup,
    versionPath,
    claudeMdPath,
    installedSkills,
    installedAgents,
    installedHookScripts,
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
