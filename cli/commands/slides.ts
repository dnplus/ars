/**
 * @command slides
 * @description Compatibility alias for `npx ars review open`
 *
 * Usage:
 *   npx ars slides <epId>
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';

export async function run(args: string[]) {
  const target = args[0];
  const root = path.resolve(__dirname, '../..');

  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars slides ep005');
    process.exit(1);
  }

  const { series, epId } = resolveEpisodeTarget(target, root);
  const ctx = resolveSeriesContext(series);

  const filePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Warning: Episode ${epId} not found at ${filePath}. Opening anyway...`);
  }

  console.log(`🚀 Starting review surface for ${series}/${epId}...`);

  const viteProcess = spawn('npm', ['run', 'dev:studio'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EP: epId,
      SERIES: series,
    },
    cwd: root,
  });

  viteProcess.on('close', (code) => {
    process.exit(code || 0);
  });
}
