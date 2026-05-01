/**
 * @command init
 * @description Bootstrap a new ARS repo and optionally initialize its only active series
 *
 * Usage:
 *   npx ars init [series-name] [options]
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { getRepoRoot } from '../lib/ars-config';
import { ensureRepoInitialized } from '../lib/repo-init';
import { getActiveSeries, listUserSeries, setActiveSeries, validateSeriesName } from '../lib/context';
import { isTmuxAvailable } from '../lib/tmux';

function preflight(): void {
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor < 22) {
    console.error(`❌ Node ${process.versions.node} is too old. ARS needs Node 22.12.0 or newer.`);
    process.exit(1);
  }

  // Skip the external-dependency checks (Claude CLI, tmux) when running in
  // CI / test environments that exercise `init` against a temp consumer repo
  // but don't have the runtime tooling installed. This mirrors the existing
  // ARS_SKIP_REMOTION_SKILL_INSTALL escape hatch used by series-workflow tests.
  if (process.env.ARS_SKIP_PREFLIGHT_CHECKS === '1') {
    return;
  }

  const claude = spawnSync('claude', ['--version'], { stdio: 'pipe' });
  if (claude.status !== 0) {
    console.error('❌ Claude CLI not found in PATH.');
    console.error('   Install it from https://docs.claude.com/en/docs/claude-code, then re-run `ars init`.');
    process.exit(1);
  }

  if (!isTmuxAvailable()) {
    console.warn('⚠️  tmux not found. `ars` will fall back to direct Claude launch (no session wrapping).');
  }
}

const HELP = `
Usage: npx ars init [series-name] [options]

Initializes .ars/config.json, syncs the ARS engine/plugin assets into this repo,
copies the template series into src/episodes/<series-name>, and sets project.activeSeries.

Options:
  --force              Overwrite config, engine, CLAUDE.md, and version metadata
  --force-engine       Overwrite engine files and version metadata only
  --force-config       Overwrite config.json only
  --force-claude-md    Rebuild the ARS block in CLAUDE.md
  --skip-series        Initialize the repo without copying the template series
  -y, --yes            Skip interactive confirmation and use defaults
  -q, --quiet          Suppress non-error output
`;

export async function run(args: string[]) {
  const { options, seriesName } = parseArgs(args);
  preflight();
  const root = getRepoRoot();
  const result = await ensureRepoInitialized({
    force: options.force,
    forceEngine: options.forceEngine,
    forceConfig: options.forceConfig,
    forceClaudeMd: options.forceClaudeMd,
    yes: options.yes,
    quiet: options.quiet,
    root,
  });

  if (options.skipSeries) {
    if (!options.quiet) {
      console.log(`✅ Wrote ${result.configPath}`);
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
        console.log(`✅ Installed ${result.installedSkills.length} ARS skills into .claude/skills/ars:<name>/`);
      }
      console.log(`✅ Wrote ${result.versionPath}`);
      if (result.usedDefaults) {
        console.log('   Non-interactive defaults were applied.');
      }
      if (result.npmInstalled) {
        console.log('✅ Ran npm install');
      }
      logGitBootstrap(result.git);
      if (result.remotionSkillInstalled) {
        console.log('✅ Installed project-scoped Remotion skill for Claude Code');
      } else {
        console.log('⚠️  Failed to install project-scoped Remotion skill for Claude Code');
      }
      console.log('ℹ️  Skipped series initialization (--skip-series).');
    }
    return;
  }

  const targetSeries = seriesName;
  if (!targetSeries) {
    throw new Error('Please provide a series name');
  }
  validateSeriesName(targetSeries);
  const activeSeries = getActiveSeries(root);
  const existingUserSeries = listUserSeries(root);

  if (activeSeries && activeSeries !== targetSeries) {
    console.error(`❌ This repo is already initialized for series "${activeSeries}".`);
    console.error('   ARS now supports one active series per repo.');
    console.error('');
    console.error('   To switch to a different series, choose one:');
    console.error(`     • Keep "${activeSeries}" — re-run with the same name: npx ars init ${activeSeries}`);
    console.error(`     • Replace it — remove the old series first, then re-run:`);
    console.error(`         rm -rf "${path.join('src', 'episodes', activeSeries)}" "${path.join('public', 'episodes', activeSeries)}"`);
    console.error(`         (and clear "project.activeSeries" in .ars/config.json)`);
    console.error(`         npx ars init ${targetSeries}`);
    process.exit(1);
  }

  const conflictingSeries = existingUserSeries.filter((series) => series !== targetSeries);
  if (conflictingSeries.length > 0) {
    console.error(`❌ Found existing user series: ${conflictingSeries.join(', ')}`);
    console.error('   ARS now supports one active series per repo.');
    console.error('');
    console.error(`   Remove the existing series before initializing "${targetSeries}":`);
    for (const series of conflictingSeries) {
      console.error(`     rm -rf "${path.join('src', 'episodes', series)}" "${path.join('public', 'episodes', series)}"`);
    }
    console.error(`   Then re-run: npx ars init ${targetSeries}`);
    process.exit(1);
  }

  const srcDir = path.join(root, 'src/episodes', targetSeries);
  const publicDir = path.join(root, 'public/episodes', targetSeries);
  const templateSrcDir = path.join(root, 'src/episodes/template');
  const templatePublicDir = path.join(root, 'public/episodes/template/shared');

  if (fs.existsSync(srcDir)) {
    if (!options.force) {
      console.error(`❌ Series "${targetSeries}" already exists at ${srcDir}`);
      console.error('');
      console.error('   To overwrite the existing series files, re-run with --force:');
      console.error(`     npx ars init ${targetSeries} --force`);
      console.error('   Note: --force removes the existing series directory before re-copying the template.');
      process.exit(1);
    }
    fs.rmSync(srcDir, { recursive: true, force: true });
    if (!options.quiet) {
      console.log(`🗑  Removed existing series at src/episodes/${targetSeries}/ (--force)`);
    }
  }

  if (!fs.existsSync(templateSrcDir)) {
    console.error('❌ Template series not found at src/episodes/template/');
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`✅ Wrote ${result.configPath}`);
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
      console.log(`✅ Installed ${result.installedSkills.length} ARS skills into .claude/skills/ars:<name>/`);
    }
    console.log(`✅ Wrote ${result.versionPath}`);
    if (result.usedDefaults) {
      console.log('   Non-interactive defaults were applied.');
    }
    if (result.npmInstalled) {
      console.log('✅ Ran npm install');
    }
    logGitBootstrap(result.git);
    if (result.remotionSkillInstalled) {
      console.log('✅ Installed project-scoped Remotion skill for Claude Code');
    } else {
      console.log('⚠️  Failed to install project-scoped Remotion skill for Claude Code');
    }
    console.log(`🚀 Initializing series "${targetSeries}" from template...`);
  }

  // 複製 src/episodes/template/ → src/episodes/{seriesName}/
  copyDir(templateSrcDir, srcDir);
  // Rewrite copied template asset references from "episodes/template/" → "episodes/<seriesName>/".
  rewriteSeriesAssetReferences(srcDir, 'template', targetSeries);
  // Apply layout choice from init prompt
  if (result.shellLayout === 'shorts') {
    rewriteShellLayout(srcDir, 'shorts');
    if (!options.quiet) {
      console.log(`✅ Set shell.layout = 'shorts' in series-config.ts`);
    }
  }
  rewriteSpeechConfig(srcDir, result.ttsProvider);
  if (!options.quiet) {
    if (result.ttsProvider === 'minimax') {
      console.log(`✅ Enabled MiniMax TTS in series-config.ts`);
    } else {
      console.log(`✅ Set TTS provider = none (audio disabled) in series-config.ts`);
    }
  }
  // Apply channel name if collected during init prompt
  if (result.config.project?.channelName) {
    rewriteChannelName(srcDir, result.config.project.channelName);
    if (!options.quiet) {
      console.log(`✅ Set channelName = '${result.config.project.channelName}' in series-config.ts`);
    }
  }
  if (!options.quiet) {
    console.log(`✅ Created: src/episodes/${targetSeries}/`);
  }

  // 建立 public dirs
  fs.mkdirSync(path.join(publicDir, 'shared'), { recursive: true });
  if (!options.quiet) {
    console.log(`✅ Created: public/episodes/${targetSeries}/`);
  }

  // 複製 shared 資源（vtuber 等）
  if (fs.existsSync(templatePublicDir)) {
    copyDir(templatePublicDir, path.join(publicDir, 'shared'));
    if (!options.quiet) {
      console.log(`✅ Created: public/episodes/${targetSeries}/shared/`);
    }
  }

  const configPath = setActiveSeries(targetSeries, root);
  if (options.quiet) {
    return;
  }

  console.log(`✅ Updated active series in ${path.relative(root, configPath)}`);

  // Root.tsx 現在自動掃描 src/episodes/，不需要手動註冊
  console.log(`ℹ️  Series will be auto-discovered by Root.tsx require.context`);
  console.log(`ℹ️  Audio/TTS selection is stored in series-config.ts. Choose minimax during init, or enable it later when you're ready to wire MiniMax.`);

  const channelLabel = result.config.project?.channelName ?? 'template default';
  const ttsLabel = result.ttsProvider === 'minimax'
    ? 'MiniMax enabled'
    : 'disabled for now';
  const youtubeLabel = result.config.publish.youtube.enabled
    ? 'enabled'
    : 'disabled for now';

  console.log(`
🎉 Series "${targetSeries}" initialized!

Initial decisions:
  • Channel display name: ${channelLabel}
  • Layout: ${result.shellLayout}
  • Audio/TTS: ${ttsLabel}
  • YouTube publish: ${youtubeLabel}

What init finished:
  • Created the repo scaffold, ARS engine, plugin skills, and demo episode
  • Set "${targetSeries}" as project.activeSeries
  • Left brand voice, colors, assets, and SERIES_GUIDE.md for /ars:onboard

Next steps:
  1. Run \`ars\` to launch Claude Code with the ARS plugin
  2. Run /ars:onboard — open the Studio demo and tune theme, brand, and VTuber
  3. Run /ars:plan <topic> — paste URLs, notes, or ideas to plan your first episode
`);
}

function logGitBootstrap(git: {
  available: boolean;
  initialized: boolean;
  alreadyRepo: boolean;
}): void {
  if (!git.available) {
    console.log('ℹ️  Git command not found; skipped git init.');
    return;
  }

  if (git.initialized) {
    console.log('✅ Initialized git repository');
    return;
  }

  if (git.alreadyRepo) {
    console.log('✅ Git repository already initialized');
  }
}

function parseArgs(args: string[]): {
  seriesName?: string;
  options: {
    force: boolean;
    forceEngine: boolean;
    forceConfig: boolean;
    forceClaudeMd: boolean;
    skipSeries: boolean;
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
  const skipSeries = args.includes('--skip-series');

  if (skipSeries && seriesName) {
    throw new Error('Cannot use --skip-series with a series name argument');
  }

  if (!seriesName && !skipSeries) {
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
      skipSeries,
      yes: args.includes('--yes') || args.includes('-y'),
      quiet: args.includes('--quiet') || args.includes('-q'),
    },
  };
}

/**
 * Rewrite public asset references after copying from template.
 * Template uses "episodes/template/" — consumer series must use "episodes/<series>/".
 */
function rewriteSeriesAssetReferences(seriesDir: string, fromSeries: string, toSeries: string): void {
  if (!fs.existsSync(seriesDir)) return;
  for (const entry of fs.readdirSync(seriesDir, { withFileTypes: true })) {
    const entryPath = path.join(seriesDir, entry.name);
    if (entry.isDirectory()) {
      rewriteSeriesAssetReferences(entryPath, fromSeries, toSeries);
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    const content = fs.readFileSync(entryPath, 'utf-8');
    const updated = content.replaceAll(`episodes/${fromSeries}/`, `episodes/${toSeries}/`);
    if (updated !== content) {
      fs.writeFileSync(entryPath, updated, 'utf-8');
    }
  }
}

function rewriteShellLayout(seriesDir: string, layout: 'streaming' | 'shorts'): void {
  const configPath = path.join(seriesDir, 'series-config.ts');
  if (!fs.existsSync(configPath)) return;
  const content = fs.readFileSync(configPath, 'utf-8');
  const updated = content.replace(/layout:\s*'streaming'/, `layout: '${layout}'`);
  if (updated !== content) fs.writeFileSync(configPath, updated, 'utf-8');
}

function rewriteChannelName(seriesDir: string, channelName: string): void {
  const configPath = path.join(seriesDir, 'series-config.ts');
  if (!fs.existsSync(configPath)) return;
  const content = fs.readFileSync(configPath, 'utf-8');
  const updated = content.replace(/channelName:\s*'Your Channel Name'/, `channelName: '${channelName.replace(/'/g, "\\'")}'`);
  if (updated !== content) fs.writeFileSync(configPath, updated, 'utf-8');
}

function rewriteSpeechConfig(seriesDir: string, ttsProvider: 'none' | 'minimax'): void {
  const configPath = path.join(seriesDir, 'series-config.ts');
  if (!fs.existsSync(configPath)) return;
  const content = fs.readFileSync(configPath, 'utf-8');
  const enabled = ttsProvider === 'minimax';
  const updated = content
    .replace(/speech:\s*{\s*enabled:\s*(true|false)/, `speech: {\n    enabled: ${String(enabled)}`)
    .replace(/provider:\s*'minimax'/, `provider: 'minimax'`);
  if (updated !== content) fs.writeFileSync(configPath, updated, 'utf-8');
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
