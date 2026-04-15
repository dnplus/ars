/**
 * @command slides
 * @description Launch web slides viewer for a specific episode
 *
 * Usage:
 *   npx ars slides <series>/<epId>
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { resolveSeriesContext, parseTarget } from '../lib/context';

export async function run(args: string[]) {
  const target = args[0];
  const root = path.resolve(__dirname, '../..');

  if (!target) {
    console.error('❌ 請提供 target，格式：<series>/<epId>');
    console.log('Usage: npx ars slides gss/ep005');
    process.exit(1);
  }

  const { series, epId } = parseTarget(target);
  const ctx = resolveSeriesContext(series);

  const filePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Warning: Episode ${epId} not found at ${filePath}. Opening anyway...`);
  }

  console.log(`🚀 Starting Slides for ${series}/${epId}...`);

  const viteProcess = spawn('npm', ['run', 'dev:slides'], {
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
