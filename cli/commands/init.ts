/**
 * @command init
 * @description Initialize a new series from the template
 *
 * Usage:
 *   npx ars init <series-name>
 */
import fs from 'fs';
import path from 'path';

export async function run(args: string[]) {
  const seriesName = args[0];
  const root = path.resolve(__dirname, '../..');

  if (!seriesName) {
    console.error('❌ Please provide a series name');
    console.log('Usage: npx ars init <series-name>');
    process.exit(1);
  }

  if (seriesName.includes('/') || /\s/.test(seriesName)) {
    console.error('❌ Series name cannot contain / or spaces');
    process.exit(1);
  }

  const srcDir = path.join(root, 'src/episodes', seriesName);
  const publicDir = path.join(root, 'public/episodes', seriesName);
  const templateSrcDir = path.join(root, 'src/episodes/template');
  const templatePublicDir = path.join(root, 'public/episodes/template/shared');

  if (fs.existsSync(srcDir)) {
    console.error(`❌ Series "${seriesName}" already exists at ${srcDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(templateSrcDir)) {
    console.error('❌ Template series not found at src/episodes/template/');
    process.exit(1);
  }

  console.log(`🚀 Initializing series "${seriesName}" from template...`);

  // 複製 src/episodes/template/ → src/episodes/{seriesName}/
  copyDir(templateSrcDir, srcDir);
  console.log(`✅ Created: src/episodes/${seriesName}/`);

  // 建立 public dirs
  fs.mkdirSync(path.join(publicDir, 'shared'), { recursive: true });
  console.log(`✅ Created: public/episodes/${seriesName}/`);

  // 複製 shared 資源（vtuber 等）
  if (fs.existsSync(templatePublicDir)) {
    copyDir(templatePublicDir, path.join(publicDir, 'shared'));
    console.log(`✅ Created: public/episodes/${seriesName}/shared/`);
  }

  // Root.tsx 現在自動掃描 src/episodes/，不需要手動註冊
  console.log(`ℹ️  Series will be auto-discovered by Root.tsx require.context`);

  console.log(`
🎉 Series "${seriesName}" initialized!

Next steps:
  1. Edit src/episodes/${seriesName}/series-config.ts — Customize theme, VTuber, brand info
  2. Replace public/episodes/${seriesName}/shared/vtuber/ images
  3. npx ars episode create ${seriesName}/ep001
  4. npx ars studio
`);
}

const COPY_IGNORE = ['.bak', '.DS_Store'];

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (COPY_IGNORE.some(ext => entry.name.endsWith(ext))) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
