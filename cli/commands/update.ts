import fs from 'fs';
import path from 'path';
import { getArsDir } from '../lib/ars-config';
import {
  copyDirectory,
  getSourceGitCommit,
  getTargetRepoRoot,
  locateSourcePackageRoot,
  writeEngineVersion,
} from '../lib/install';

const HELP = `
Usage: npx ars update

Backs up src/engine into .ars/backups/<timestamp>/engine and refreshes it from the installed ARS package.
`;

export async function run(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const root = getTargetRepoRoot();
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  const targetEngineDir = path.join(root, 'src', 'engine');

  if (!fs.existsSync(targetEngineDir)) {
    console.error(
      `❌ Missing ${targetEngineDir}. Run "npx ars setup" before using update.`,
    );
    process.exit(1);
  }

  const backupTimestamp = new Date().toISOString().replace(/:/g, '-');
  const backupEngineDir = path.join(
    getArsDir(root),
    'backups',
    backupTimestamp,
    'engine',
  );

  copyDirectory(targetEngineDir, backupEngineDir, { overwrite: false });
  copyDirectory(path.join(sourceRoot, 'src', 'engine'), targetEngineDir, {
    overwrite: true,
  });

  const engineVersionPath = writeEngineVersion(
    {
      commit: getSourceGitCommit(sourceRoot),
      copiedAt: new Date().toISOString(),
      source: sourceRoot,
    },
    root,
  );

  console.log(`✅ Backed up engine to ${backupEngineDir}`);
  console.log(`✅ Refreshed engine from ${path.join(sourceRoot, 'src', 'engine')}`);
  console.log(`✅ Wrote ${engineVersionPath}`);
  console.log('Rollback hint:');
  console.log(`  rm -rf "${targetEngineDir}"`);
  console.log(`  cp -R "${backupEngineDir}" "${targetEngineDir}"`);
}
