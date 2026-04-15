/**
 * @command studio
 * @description Launch Remotion Studio (all series auto-loaded)
 */
import { spawn } from 'child_process';
import { rmSync } from 'fs';
import path from 'path';

export async function run(_args: string[]) {
  const root = path.resolve(__dirname, '../..');

  // 清除 webpack cache，避免新 episode 載入不到
  const webpackCache = path.join(root, 'node_modules', '.cache', 'webpack');
  try {
    rmSync(webpackCache, { recursive: true, force: true });
    console.log(`🧹 Cleared webpack cache`);
  } catch {}

  console.log(`🎬 Starting Remotion Studio...`);
  console.log(`   All series in src/episodes/ will be auto-loaded`);

  const studio = spawn('npx', ['remotion', 'studio'], {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env },
  });

  studio.on('close', (code) => {
    process.exit(code || 0);
  });
}
