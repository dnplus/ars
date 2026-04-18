/**
 * @command publish
 * @description High-level release commands that compose prepare/package/upload steps.
 *
 * Usage:
 *   npx ars publish package <epId>
 *   npx ars publish youtube <epId>
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createInterface } from 'readline';
import { resolveEpisodeTarget } from '../lib/context';
import { readPreparedYoutubeCandidate } from '../lib/prepare-artifact';
import { getRepoRoot } from '../lib/ars-config';
import { getRuntimePackageInfo } from '../lib/runtime-package';

type PublishMode = 'package' | 'youtube';

interface PublishOptions {
  mode: PublishMode;
  series: string;
  epId: string;
  dryRun: boolean;
  yes: boolean;
  force: boolean;
  privacy: 'public' | 'unlisted' | 'private';
}

const ROOT = getRepoRoot();

const HELP = `
🚀 ARS Publish — High-Level Release Commands

Usage:
  npx ars publish package <epId>            Export thumbnail + SRT + render
  npx ars publish youtube <epId>            Package + upload YouTube

Options:
  --dry-run              Execute local safe steps; keep external uploads in dry-run mode
  --yes                  Skip confirmation prompt and execute immediately
  --force                Rebuild local artifacts even if they already exist
  --privacy <status>     YouTube privacy: public|unlisted|private (default: private)

Notes:
  - Prefer publish* for daily release; use low-level upload* only for partial reruns/debugging.
  - publish youtube expects a prepared artifact from:
      npx ars prepare youtube <epId>
  - Social publishing has been removed from ARS core. Move that workflow into an extension.
`;

function parseArgs(args: string[]): PublishOptions {
  const mode = args[0] as PublishMode;
  const target = args[1];

  if (!mode || !target || !['package', 'youtube'].includes(mode)) {
    console.log(HELP);
    process.exit(mode && target ? 1 : 0);
  }

  const { series, epId } = resolveEpisodeTarget(target, ROOT);
  const privacyIdx = args.indexOf('--privacy');
  const privacy = privacyIdx !== -1 && args[privacyIdx + 1]
    ? args[privacyIdx + 1] as PublishOptions['privacy']
    : 'private';

  return {
    mode,
    series,
    epId,
    dryRun: args.includes('--dry-run'),
    yes: args.includes('--yes'),
    force: args.includes('--force'),
    privacy,
  };
}

async function confirmExecution(opts: PublishOptions, target: string): Promise<void> {
  if (opts.dryRun || opts.yes) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`\nConfirm publish ${opts.mode} for ${target}? [y/N] `, (value) => {
      rl.close();
      resolve(value.trim().toLowerCase());
    });
  });

  if (answer !== 'y' && answer !== 'yes') {
    console.log('   Aborted.');
    process.exit(0);
  }
}

function cliArgs(...args: string[]): [string, string[]] {
  const { packageRoot } = getRuntimePackageInfo(import.meta.url);
  const cliEntry = path.join(packageRoot, 'cli', 'index.ts');
  const tsxBin = path.join(packageRoot, 'node_modules', '.bin', 'tsx');
  return [tsxBin, [cliEntry, ...args]];
}

function remotionArgs(...args: string[]): [string, string[]] {
  return ['npx', ['remotion', ...args]];
}

function runStep(label: string, bin: string, args: string[]): void {
  const display = `${bin} ${args.join(' ')}`;
  console.log(`   $ ${display}`);
  execFileSync(bin, args, { stdio: 'inherit', cwd: ROOT });
  console.log(`   ✅ ${label}`);
}

function runLocalStep(label: string, bin: string, args: string[]): void {
  const display = `${bin} ${args.join(' ')}`;
  console.log(`   $ ${display}`);
  execFileSync(bin, args, { stdio: 'inherit', cwd: ROOT });
  console.log(`   ✅ ${label}`);
}

function tryRunLocalStep(label: string, bin: string, args: string[]): boolean {
  try {
    runLocalStep(label, bin, args);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`   ⚠️  ${label} skipped: ${detail}`);
    return false;
  }
}

function ensureYoutubeReady(series: string, epId: string): void {
  if (!readPreparedYoutubeCandidate(series, epId)) {
    console.error(`Error: YouTube metadata not found.`);
    console.error(`   1. Run: npx ars prepare youtube ${epId}`);
    console.error(`   2. In Claude Code: /ars:prepare-youtube ${epId}`);
    process.exit(1);
  }
}

function ensurePackageOutputs(series: string, epId: string): void {
  const renderPath = path.join(ROOT, 'output', 'render', series, `${epId}.mp4`);
  const thumbnailPath = path.join(ROOT, 'output', 'publish', series, epId, 'thumbnail.png');
  const missing = [
    !fs.existsSync(renderPath) && renderPath,
    !fs.existsSync(thumbnailPath) && thumbnailPath,
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`❌ Package outputs missing:`);
    for (const item of missing) {
      console.error(`   • ${path.relative(ROOT, item as string)}`);
    }
    process.exit(1);
  }
}

function localOutputPaths(series: string, epId: string) {
  return {
    renderPath: path.join(ROOT, 'output', 'render', series, `${epId}.mp4`),
    thumbnailPath: path.join(ROOT, 'output', 'publish', series, epId, 'thumbnail.png'),
    srtPath: path.join(ROOT, 'output', 'srt', series, `${epId}.srt`),
  };
}

function publishPackage(target: string, series: string, epId: string, dryRun: boolean, force: boolean): void {
  console.log(`\n📦 Publish package: ${target}`);
  if (dryRun) {
    console.log('   ℹ️  Dry run for publish means: local asset steps still execute; only external uploads stay dry-run.');
  }
  const { thumbnailPath, srtPath, renderPath } = localOutputPaths(series, epId);

  if (!force && fs.existsSync(thumbnailPath)) {
    console.log(`   ⏭️  Thumbnail export skipped: ${path.relative(ROOT, thumbnailPath)}`);
  } else {
    runLocalStep('Thumbnail export', ...cliArgs('export', 'thumbnail', target));
  }

  if (!force && fs.existsSync(srtPath)) {
    console.log(`   ⏭️  SRT export skipped: ${path.relative(ROOT, srtPath)}`);
  } else {
    tryRunLocalStep('SRT export', ...cliArgs('export', 'srt', target));
  }

  if (!force && fs.existsSync(renderPath)) {
    console.log(`   ⏭️  Render skipped: ${path.relative(ROOT, renderPath)}`);
  } else if (dryRun) {
    console.log(`   DRY RUN: would render output/render/${series}/${epId}.mp4`);
  } else {
    runLocalStep('Render', ...remotionArgs('render', `${series}--${epId}`, `output/render/${series}/${epId}.mp4`));
  }
}

export async function run(args: string[]) {
  const opts = parseArgs(args);
  const target = `${opts.series}/${opts.epId}`;

  console.log(`\n🚀 Publish: ${opts.mode} (${target})`);
  console.log(`${'═'.repeat(50)}`);
  await confirmExecution(opts, target);

  if (opts.mode === 'package') {
    publishPackage(target, opts.series, opts.epId, opts.dryRun, opts.force);
    return;
  }

  if (opts.mode === 'youtube') {
    ensureYoutubeReady(opts.series, opts.epId);
    publishPackage(target, opts.series, opts.epId, opts.dryRun, opts.force);
    if (!opts.dryRun) ensurePackageOutputs(opts.series, opts.epId);
    runStep(
      'YouTube upload',
      ...cliArgs('upload', 'youtube', target, '--privacy', opts.privacy, ...(opts.dryRun ? ['--dry-run'] : [])),
    );
  }
}
