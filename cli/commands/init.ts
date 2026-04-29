/**
 * @command init
 * @description Bootstrap a new ARS repo and optionally initialize its only active series
 *
 * Usage:
 *   npx ars init [series-name] [options]
 */
import fs from 'fs';
import path from 'path';
import { getRepoRoot } from '../lib/ars-config';
import { ensureRepoInitialized } from '../lib/repo-init';
import { getActiveSeries, listAvailableSeries, setActiveSeries, validateSeriesName } from '../lib/context';

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
        console.log(`✅ Installed ${result.installedSkills.length} ARS skills into .claude/skills/ars/`);
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
  const existingUserSeries = listAvailableSeries(root).filter((series) => series !== 'template');

  if (activeSeries && activeSeries !== targetSeries) {
    console.error(`❌ This repo is already initialized for series "${activeSeries}".`);
    console.error('   ARS now supports one active series per repo.');
    process.exit(1);
  }

  const conflictingSeries = existingUserSeries.filter((series) => series !== targetSeries);
  if (conflictingSeries.length > 0) {
    console.error(`❌ Found existing user series: ${conflictingSeries.join(', ')}`);
    console.error('   ARS now supports one active series per repo.');
    process.exit(1);
  }

  const srcDir = path.join(root, 'src/episodes', targetSeries);
  const publicDir = path.join(root, 'public/episodes', targetSeries);
  const templateSrcDir = path.join(root, 'src/episodes/template');
  const templatePublicDir = path.join(root, 'public/episodes/template/shared');

  if (fs.existsSync(srcDir)) {
    if (!options.force) {
      console.error(`❌ Series "${targetSeries}" already exists at ${srcDir}`);
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
      console.log(`✅ Installed ${result.installedSkills.length} ARS skills into .claude/skills/ars/`);
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
  // Rewrite path references in series-config.ts from "episodes/template/" → "episodes/<seriesName>/"
  rewriteSeriesConfig(srcDir, 'template', targetSeries);
  // Apply layout choice from init prompt
  if (result.shellLayout === 'shorts') {
    rewriteShellLayout(srcDir, 'shorts');
    if (!options.quiet) {
      console.log(`✅ Set shell.layout = 'shorts' in series-config.ts`);
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
  console.log(`ℹ️  Audio/TTS starts disabled by default in series-config.ts. Enable it when you're ready to wire MiniMax.`);

  console.log(`
🎉 Series "${targetSeries}" initialized!

Next steps:
  1. Run \`ars\` to launch Claude Code with the ARS plugin
  2. Run /ars:onboard — interview-driven setup for theme, brand, and VTuber
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
