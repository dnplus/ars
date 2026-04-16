/**
 * @command init
 * @description Bootstrap a new ARS repo and initialize its only active series
 *
 * Usage:
 *   npx ars init <series-name> [options]
 */
import fs from 'fs';
import path from 'path';
import { getRepoRoot } from '../lib/ars-config';
import { ensureRepoInitialized } from '../lib/repo-init';
import { getActiveSeries, listAvailableSeries, setActiveSeries, validateSeriesName } from '../lib/context';

const HELP = `
Usage: npx ars init <series-name> [options]

Initializes .ars/config.json, syncs the ARS engine/plugin assets into this repo,
copies the template series into src/episodes/<series-name>, and sets project.activeSeries.

Options:
  --force              Overwrite config, engine, CLAUDE.md, and version metadata
  --force-engine       Overwrite engine files and version metadata only
  --force-config       Overwrite config.json only
  --force-claude-md    Rebuild the ARS block in CLAUDE.md
  -y, --yes            Skip interactive confirmation and use defaults
  -q, --quiet          Suppress non-error output
`;

export async function run(args: string[]) {
  const { options, seriesName } = parseArgs(args);
  const root = getRepoRoot();

  validateSeriesName(seriesName);
  const activeSeries = getActiveSeries(root);
  const existingUserSeries = listAvailableSeries(root).filter((series) => series !== 'template');

  if (activeSeries && activeSeries !== seriesName) {
    console.error(`❌ This repo is already initialized for series "${activeSeries}".`);
    console.error('   ARS now supports one active series per repo.');
    process.exit(1);
  }

  const conflictingSeries = existingUserSeries.filter((series) => series !== seriesName);
  if (conflictingSeries.length > 0) {
    console.error(`❌ Found existing user series: ${conflictingSeries.join(', ')}`);
    console.error('   ARS now supports one active series per repo.');
    process.exit(1);
  }

  const result = await ensureRepoInitialized({ ...options, root });
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

  if (!options.quiet) {
    console.log(`✅ Wrote ${result.configPath}`);
    console.log(`   tts.provider = ${result.config.tts.provider}`);
    console.log(
      `   publish.youtube.enabled = ${String(result.config.publish.youtube.enabled)}`,
    );
    if (result.copiedFiles.length > 0) {
      console.log(`✅ Synced engine into ${path.join(result.root, 'src', 'engine')}`);
      for (const copiedFile of result.copiedFiles) {
        console.log(`   ${copiedFile}`);
      }
    }
    if (result.claudeMdPath) {
      console.log(`✅ Patched ${result.claudeMdPath}`);
    }
    if (result.installedSkills.length > 0) {
      console.log(`✅ Installed ${result.installedSkills.length} ARS skills into .claude/skills/ars/`);
    }
    console.log(`✅ Wrote ${result.versionPath}`);
    if (result.usedDefaults) {
      console.log('   Non-interactive defaults were applied.');
    }
    if (result.npmInstalled) {
      console.log('✅ Ran npm install');
    }
    console.log(`🚀 Initializing series "${seriesName}" from template...`);
  }

  // 複製 src/episodes/template/ → src/episodes/{seriesName}/
  copyDir(templateSrcDir, srcDir);
  // Rewrite card type strings from "template/<name>" → "<seriesName>/<name>"
  rewriteCardTypes(srcDir, 'template', seriesName);
  // Rewrite path references in series-config.ts from "episodes/template/" → "episodes/<seriesName>/"
  rewriteSeriesConfig(srcDir, 'template', seriesName);
  if (!options.quiet) {
    console.log(`✅ Created: src/episodes/${seriesName}/`);
  }

  // 建立 public dirs
  fs.mkdirSync(path.join(publicDir, 'shared'), { recursive: true });
  if (!options.quiet) {
    console.log(`✅ Created: public/episodes/${seriesName}/`);
  }

  // 複製 shared 資源（vtuber 等）
  if (fs.existsSync(templatePublicDir)) {
    copyDir(templatePublicDir, path.join(publicDir, 'shared'));
    if (!options.quiet) {
      console.log(`✅ Created: public/episodes/${seriesName}/shared/`);
    }
  }

  const configPath = setActiveSeries(seriesName, root);
  if (options.quiet) {
    return;
  }

  console.log(`✅ Updated active series in ${path.relative(root, configPath)}`);

  // Root.tsx 現在自動掃描 src/episodes/，不需要手動註冊
  console.log(`ℹ️  Series will be auto-discovered by Root.tsx require.context`);

  console.log(`
🎉 Series "${seriesName}" initialized!

Next steps:
  1. Edit src/episodes/${seriesName}/series-config.ts — Customize theme, VTuber, brand info
  2. Replace public/episodes/${seriesName}/shared/vtuber/ images
  3. /ars:plan <topic>   — 貼 URL、筆記、文章片段，或直接描述題材
  4. /ars:build <epId>
`);
}

function parseArgs(args: string[]): {
  seriesName: string;
  options: {
    force: boolean;
    forceEngine: boolean;
    forceConfig: boolean;
    forceClaudeMd: boolean;
    yes: boolean;
    quiet: boolean;
  };
} {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const positional = args.filter((arg) => !arg.startsWith('-'));
  const seriesName = positional[0];

  if (!seriesName) {
    console.error('❌ Please provide a series name');
    console.log(HELP.trim());
    process.exit(1);
  }

  return {
    seriesName,
    options: {
      force: args.includes('--force'),
      forceEngine: args.includes('--force-engine'),
      forceConfig: args.includes('--force-config'),
      forceClaudeMd: args.includes('--force-claude-md'),
      yes: args.includes('--yes') || args.includes('-y'),
      quiet: args.includes('--quiet') || args.includes('-q'),
    },
  };
}

/**
 * Rewrite path references in series-config.ts after copying from template.
 * Template uses "episodes/template/" — consumer series must use "episodes/<series>/".
 */
function rewriteSeriesConfig(seriesDir: string, fromSeries: string, toSeries: string): void {
  const configPath = path.join(seriesDir, 'series-config.ts');
  if (!fs.existsSync(configPath)) return;

  const content = fs.readFileSync(configPath, 'utf-8');
  const updated = content.replaceAll(`episodes/${fromSeries}/`, `episodes/${toSeries}/`);
  if (updated !== content) {
    fs.writeFileSync(configPath, updated, 'utf-8');
  }
}

/**
 * Rewrite card `type` strings in spec.ts files after copying from template.
 * Template cards use "template/<name>" — consumer series must use "<series>/<name>".
 */
function rewriteCardTypes(seriesDir: string, fromSeries: string, toSeries: string): void {
  const cardsDir = path.join(seriesDir, 'cards');
  if (!fs.existsSync(cardsDir)) return;

  for (const cardName of fs.readdirSync(cardsDir)) {
    const specPath = path.join(cardsDir, cardName, 'spec.ts');
    if (!fs.existsSync(specPath)) continue;

    let content = fs.readFileSync(specPath, 'utf-8');
    const updated = content.replaceAll(`"${fromSeries}/${cardName}"`, `"${toSeries}/${cardName}"`);
    if (updated !== content) {
      fs.writeFileSync(specPath, updated, 'utf-8');
    }
  }
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
