import path from 'path';
import { CONFIG_SCHEMA_VERSION } from '../lib/ars-config';
import {
  backupEngine,
  detectInstallMethod,
  getTargetRepoRoot,
  installStatusLine,
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

Backs up src/engine into .ars/backups/<timestamp>/engine and refreshes it from the installed ARS package.

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

  console.log(`✅ Backed up engine to ${result.backupDir}`);
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
  console.log('Rollback hint:');
  console.log(`  rm -rf "${path.join(result.root, 'src', 'engine')}"`);
  console.log(`  cp -R "${result.backupDir}" "${path.join(result.root, 'src', 'engine')}"`);
}

export async function updateCommand(options: UpdateOptions & { root?: string }):
Promise<{
  root: string;
  sourceRoot: string;
  backupDir: string;
  versionPath: string;
  claudeMdPath?: string;
  installedSkills: string[];
  installedAgents: string[];
  installedHookScripts: string[];
}> {
  const root = options.root ?? getTargetRepoRoot();
  const runtime = getRuntimePackageInfo(import.meta.url);
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  const backupDir = backupEngine(root);

  syncEngineFiles({
    root,
    sourceRoot,
    overwriteEngine: true,
    overwriteSupportFiles: options.force || options.forceEngine,
  });

  const installedSkills = syncSkills({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
  const installedAgents = syncAgents({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
  const installedHookScripts = syncHookScripts({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
  patchClaudeSettings({ root });
  installStatusLine(runtime.pluginRoot);

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
    backupDir,
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
