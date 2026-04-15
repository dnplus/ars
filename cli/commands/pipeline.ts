/**
 * @command pipeline
 * @description Run the episode pipeline: audio → validate → render → export → YouTube upload.
 *
 * Usage:
 *   npx ars pipeline <series>/<epId> [options]
 *
 * Options:
 *   --from <step>     Resume from a specific step (audio|validate|render|export|upload-yt|upload-threads|upload-fbgroup)
 *   --until <step>    Stop after a specific step
 *   --dry-run         Preview all steps without executing uploads
 *   --no-interactive  Skip all checkpoints (no readline prompts)
 *   --privacy <s>     YouTube privacy: public|unlisted|private (default: private)
 *
 * Draft is NOT included — write the episode .ts in Claude Code first, then run pipeline.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createInterface } from 'readline';
import { parseTarget, resolveSeriesContext } from '../lib/context';
import { loadEpisodeMetadata } from '../lib/episode-file';
import { notify } from '../lib/discord-notify';

const STEPS = [
  'audio',
  'validate',
  'render',
  'export',
  'upload-yt',
  'upload-threads',
  'upload-fbgroup',
] as const;

type StepName = typeof STEPS[number];

interface PipelineState {
  epId: string;
  series: string;
  startedAt: string;
  steps: Record<string, { status: 'done' | 'pending' | 'skipped'; at?: string }>;
}

const HELP = `
🔗 ARS Pipeline — Full Episode Pipeline

Usage:
  npx ars pipeline <series>/<epId> [options]

Steps (in order):
  1. audio          Generate TTS audio + subtitles
  2. validate       Validate episode structure
  3. render         Render video with Remotion
  4. export         Export cover + SRT
  5. upload-yt      Upload to YouTube (private)
  6. upload-threads Post to Threads (requires prepare social after YouTube upload)
  7. upload-fbgroup Post to FB Group (requires prepare social after YouTube upload)

Options:
  --from <step>       Resume from step (skip completed steps)
  --until <step>      Stop after step
  --dry-run           Preview uploads without executing
  --no-interactive    Skip checkpoints
  --privacy <status>  YouTube privacy (default: private)

Examples:
  npx ars pipeline template/ep001
  npx ars pipeline template/ep001 --from render
  npx ars pipeline template/ep001 --until export
  npx ars pipeline template/ep001 --dry-run
`;

function parseArgs(args: string[]) {
  const target = args[0];
  if (!target || target.startsWith('--')) {
    console.log(HELP);
    process.exit(0);
  }

  const { series, epId } = parseTarget(target);

  const fromIdx = args.indexOf('--from');
  const untilIdx = args.indexOf('--until');
  const from = fromIdx !== -1 ? args[fromIdx + 1] as StepName : undefined;
  const until = untilIdx !== -1 ? args[untilIdx + 1] as StepName : undefined;

  const privacyIdx = args.indexOf('--privacy');
  const privacy = privacyIdx !== -1 ? args[privacyIdx + 1] : 'private';

  return {
    series,
    epId,
    from,
    until,
    dryRun: args.includes('--dry-run'),
    noInteractive: args.includes('--no-interactive'),
    privacy,
  };
}

// ── State Persistence ──

function statePath(series: string, epId: string): string {
  const ctx = resolveSeriesContext(series);
  return path.join(ctx.publicEpisodesDir, epId, 'pipeline-state.json');
}

function loadState(series: string, epId: string): PipelineState {
  const p = statePath(series, epId);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return {
    epId,
    series,
    startedAt: new Date().toISOString(),
    steps: {},
  };
}

function saveState(state: PipelineState): void {
  const p = statePath(state.series, state.epId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

// ── Readline Checkpoint ──

async function checkpoint(message: string, noInteractive: boolean): Promise<boolean> {
  if (noInteractive) return true;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`\n   ${message} [y/n/e] `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === 'e') {
        console.log('   📝 Edit the file, then re-run with --from <current-step>');
        resolve(false);
      } else {
        resolve(a === 'y' || a === 'yes' || a === '');
      }
    });
  });
}

// ── Step Execution ──

const ROOT = path.resolve(__dirname, '../..');

function execStep(bin: string, stepArgs: string[], label: string): void {
  const display = `${bin} ${stepArgs.join(' ')}`;
  console.log(`\n   $ ${display}`);
  try {
    execFileSync(bin, stepArgs, { stdio: 'inherit', cwd: ROOT });
    console.log(`   ✅ ${label} done`);
  } catch {
    throw new Error(`${label} failed`);
  }
}

function npxTsx(...cliArgs: string[]): [string, string[]] {
  return ['npx', ['tsx', 'cli/index.ts', ...cliArgs]];
}

function npxRemotion(...remotionArgs: string[]): [string, string[]] {
  return ['npx', ['remotion', ...remotionArgs]];
}

async function preflightPublishMetadata(
  series: string,
  epId: string,
  fromIndex: number,
  untilIndex: number,
): Promise<void> {
  const uploadYtIndex = STEPS.indexOf('upload-yt');
  const uploadThreadsIndex = STEPS.indexOf('upload-threads');
  const uploadFbIndex = STEPS.indexOf('upload-fbgroup');
  const includesYoutube = fromIndex <= uploadYtIndex && untilIndex >= uploadYtIndex;
  const includesThreads = fromIndex <= uploadThreadsIndex && untilIndex >= uploadThreadsIndex;
  const includesFbGroup = fromIndex <= uploadFbIndex && untilIndex >= uploadFbIndex;

  if (!includesYoutube && !includesThreads && !includesFbGroup) {
    return;
  }

  const metadata = await loadEpisodeMetadata(series, epId);
  const issues: string[] = [];

  if (includesYoutube && !metadata?.youtube) {
    issues.push(`Missing metadata.youtube — run: npx ars prepare youtube ${series}/${epId}`);
  }

  if ((includesThreads || includesFbGroup) && !metadata?.social?.posts?.[0]) {
    issues.push(`Missing metadata.social.posts — run: npx ars prepare social ${series}/${epId}`);
  }

  if ((includesThreads || includesFbGroup) && !metadata?.publish?.youtubeUrl) {
    issues.push(`Missing metadata.publish.youtubeUrl — upload YouTube first, then run: npx ars prepare social ${series}/${epId}`);
  }

  if (issues.length > 0) {
    console.error(`\n⚠️  Publish metadata preflight failed:`);
    for (const issue of issues) {
      console.error(`   • ${issue}`);
    }
    process.exit(1);
  }
}

// ── Main ──

export async function run(args: string[]) {
  const opts = parseArgs(args);
  const target = `${opts.series}/${opts.epId}`;
  const state = loadState(opts.series, opts.epId);

  console.log(`\n🔗 Pipeline: ${target}`);
  console.log(`${'═'.repeat(50)}`);

  // Determine step range
  const fromIndex = opts.from ? STEPS.indexOf(opts.from as StepName) : 0;
  const untilIndex = opts.until ? STEPS.indexOf(opts.until as StepName) : STEPS.length - 1;

  if (fromIndex === -1 || untilIndex === -1) {
    console.error(`❌ Invalid step. Available: ${STEPS.join(', ')}`);
    process.exit(1);
  }

  await preflightPublishMetadata(opts.series, opts.epId, fromIndex, untilIndex);

  const dryArgs = opts.dryRun ? ['--dry-run'] : [];

  for (let i = fromIndex; i <= untilIndex; i++) {
    const step = STEPS[i];
    const stepNum = i + 1;

    // Skip already completed (from state)
    if (state.steps[step]?.status === 'done' && !opts.from) {
      console.log(`\n   ⏭️  Step ${stepNum}/${STEPS.length}: ${step} (already done)`);
      continue;
    }

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`   Step ${stepNum}/${STEPS.length}: ${step}`);
    console.log(`${'─'.repeat(50)}`);

    try {
      switch (step) {
        case 'audio':
          execStep(...npxTsx('audio', 'generate', target), 'Audio generation');
          await notify({
            title: `🎙️ Audio Ready: ${opts.epId}`,
            description: `Audio generated for ${target}`,
            fields: [{ name: 'Next', value: 'Waiting for review', inline: true }],
          });
          if (!await checkpoint('Audio ready. Continue?', opts.noInteractive)) return;
          break;

        case 'validate':
          execStep(...npxTsx('episode', 'validate', target), 'Validation');
          break;

        case 'render': {
          const outFile = `output/render/${opts.series}/${opts.epId}.mp4`;
          execStep(
            ...npxRemotion('render', `${opts.series}--${opts.epId}`, outFile),
            'Render',
          );
          await notify({
            title: `🎬 Render Complete: ${opts.epId}`,
            description: `Video rendered for ${target}`,
            fields: [{ name: 'File', value: outFile, inline: true }],
          });
          if (!await checkpoint('Render complete. Continue?', opts.noInteractive)) return;
          break;
        }

        case 'export':
          execStep(...npxTsx('export', 'cover', target), 'Cover export');
          execStep(...npxTsx('export', 'srt', target), 'SRT export');
          break;

        case 'upload-yt':
          execStep(
            ...npxTsx('upload', 'youtube', target, '--privacy', opts.privacy, ...dryArgs),
            'YouTube upload',
          );
          await notify({
            title: `📤 YouTube Upload: ${opts.epId}`,
            description: `Uploaded to YouTube (${opts.privacy})`,
            color: 0xff0000,
          });
          if (!await checkpoint('YouTube uploaded. Prepare social metadata before continuing to social steps.', opts.noInteractive)) return;
          break;

        case 'upload-threads':
          execStep(
            ...npxTsx('upload', 'threads', target, ...dryArgs),
            'Threads post',
          );
          break;

        case 'upload-fbgroup':
          execStep(
            ...npxTsx('upload', 'fbgroup', target, ...dryArgs),
            'FB Group post',
          );
          break;
      }

      state.steps[step] = { status: 'done', at: new Date().toISOString() };
      saveState(state);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n   ❌ ${msg}`);
      console.log(`   💡 Fix the issue, then resume: npx ars pipeline ${target} --from ${step}`);
      state.steps[step] = { status: 'pending' };
      saveState(state);

      await notify({
        title: `❌ Pipeline Failed: ${opts.epId}`,
        description: `Step "${step}" failed: ${msg}`,
        color: 0xff6b6b,
      });
      process.exit(1);
    }
  }

  // Done
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎉 Pipeline complete: ${target}`);
  console.log(`${'═'.repeat(50)}`);

  await notify({
    title: `🎉 Pipeline Complete: ${opts.epId}`,
    description: `All steps done for ${target}`,
    color: 0x00b894,
    fields: [
      { name: 'Steps', value: `${fromIndex + 1}–${untilIndex + 1} of ${STEPS.length}`, inline: true },
    ],
  });
}
