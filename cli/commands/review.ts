/**
 * @command review
 * @description Review workflow helpers for the studio review surface and review intents.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';
import { getRuntimePackageInfo } from '../lib/runtime-package';
import {
  createReviewIntent,
  getReviewIntentsDir,
  listReviewIntentRecords,
  markAllReviewIntentsProcessed,
  markReviewIntentProcessed,
  readReviewIntent,
} from '../../src/review/review-intents';
import type { ReviewIntentFeedback, ReviewIntentSource } from '../../src/types/review-intent';

const HELP = `
Usage: npx ars review <subcommand> [options]

Subcommands:
  open <epId>                             Launch the review surface for the active series
  close <epId>                            Mark review as done and advance stage to audio
  intent list [--pending] [--json]        List review intents grouped by status
  intent show <id>                        Print a review intent JSON payload
  intent clear <id|all>                   Mark review intents as processed
  intent create [options]                 Create a review intent

Intent create options:
  --from <studio>
  --series <series>
  --ep <epId>
  --step <stepId>
  --message <text>
  --kind <visual|content|timing|other>
  --severity <low|medium|high>
  --hash <hash>
  --screenshot-path <path>
`;

const SOURCE_UI_VALUES = new Set<ReviewIntentSource['ui']>(['studio']);
const FEEDBACK_KIND_VALUES = new Set<ReviewIntentFeedback['kind']>([
  'visual',
  'content',
  'timing',
  'other',
]);
const FEEDBACK_SEVERITY_VALUES = new Set<ReviewIntentFeedback['severity']>([
  'low',
  'medium',
  'high',
]);

interface ParsedCreateOptions {
  from: ReviewIntentSource['ui'];
  series: string;
  epId: string;
  stepId: string;
  message: string;
  kind: ReviewIntentFeedback['kind'];
  severity: ReviewIntentFeedback['severity'];
  hash?: string;
  screenshotPath?: string;
}

export async function run(args: string[]) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case 'open':
      return openReview(rest);
    case 'close':
      return closeReview(rest);
    case 'intent':
      return handleIntent(rest);
    default:
      console.error(`❌ Unknown review subcommand: ${subcommand}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function openReview(args: string[]): Promise<void> {
  const target = args[0];
  const root = getRepoRoot();

  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars review open <epId>');
    process.exit(1);
  }

  const { series, epId } = resolveEpisodeTarget(target, root);
  const ctx = resolveSeriesContext(series);
  const filePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Warning: Episode ${epId} not found at ${filePath}. Opening anyway...`);
  }

  const params = new URLSearchParams({
    series,
    ep: epId,
  });

  console.log(`🚀 Starting Review for ${series}/${epId}...`);
  console.log(`   URL: /?${params.toString()}`);
  console.log(`   Review inbox: ${path.relative(root, getReviewIntentsDir(root))}`);

  // Launch the review studio using the consumer repo's own vite binary and config.
  // After `npx ars init`, the consumer has its own node_modules and vite.studio.config.ts.
  // Fall back to ARS package's vite only when running inside the ARS development repo itself.
  const { packageRoot: arsPackageRoot } = getRuntimePackageInfo(import.meta.url);
  const consumerViteBin = path.join(root, 'node_modules', '.bin', 'vite');
  const consumerViteConfig = path.join(root, 'vite.studio.config.ts');
  const arsViteBin = path.join(arsPackageRoot, 'node_modules', '.bin', 'vite');
  const arsViteConfig = path.join(arsPackageRoot, 'vite.studio.config.ts');

  const useConsumer = fs.existsSync(consumerViteBin) && fs.existsSync(consumerViteConfig);
  const viteBin = useConsumer ? consumerViteBin : arsViteBin;
  const viteConfigPath = useConsumer ? consumerViteConfig : arsViteConfig;

  const viteProcess = spawn(
    viteBin,
    ['--config', viteConfigPath],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SERIES: series,
        EP: epId,
        ARS_REPO_ROOT: root,
        ARS_PACKAGE_ROOT: arsPackageRoot,
      },
      cwd: root,
    },
  );

  viteProcess.on('close', (code) => {
    process.exit(code || 0);
  });
}

async function closeReview(args: string[]): Promise<void> {
  const target = args[0];
  const root = getRepoRoot();

  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars review close <epId>');
    process.exit(1);
  }

  const { epId } = resolveEpisodeTarget(target, root);
  console.log(`✅ Review closed for ${epId}. Stage advanced to audio.`);
}

async function handleIntent(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case 'list':
      return listIntents(rest);
    case 'show':
      return showIntent(rest);
    case 'clear':
      return clearIntent(rest);
    case 'create':
      return createIntent(rest);
    default:
      console.error(`❌ Unknown review intent subcommand: ${subcommand ?? '(missing)'}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function listIntents(args: string[]): Promise<void> {
  const root = getRepoRoot();
  const reviewDir = getReviewIntentsDir(root);
  const records = listReviewIntentRecords(root);
  const pendingOnly = args.includes('--pending');
  const jsonMode = args.includes('--json');

  const pending = records.filter(({ intent }) => !intent.processedAt);
  const processed = records.filter(({ intent }) => !!intent.processedAt);

  if (jsonMode) {
    const output = pendingOnly
      ? pending.map(({ intent }) => intent)
      : {
          pending: pending.map(({ intent }) => intent),
          processed: processed.map(({ intent }) => intent),
        };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Review inbox: ${path.relative(root, reviewDir)}`);
  if (pendingOnly) {
    printIntentGroup('Pending', pending);
  } else {
    printIntentGroup('Pending', pending);
    printIntentGroup('Processed', processed);
  }
}

function printIntentGroup(
  title: string,
  records: Array<ReturnType<typeof listReviewIntentRecords>[number]>,
): void {
  console.log(`\n${title} (${records.length})`);
  if (records.length === 0) {
    console.log('  - none');
    return;
  }

  for (const { intent } of records) {
    const summary = [
      intent.id,
      `${intent.target.series}/${intent.target.epId}`,
      `step=${intent.target.stepId}`,
      `${intent.feedback.kind}/${intent.feedback.severity}`,
      intent.processedAt ? `processedAt=${intent.processedAt}` : 'pending',
    ].join(' | ');

    console.log(`  - ${summary}`);
    console.log(`    ${intent.feedback.message}`);
  }
}

async function showIntent(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    console.error('❌ Usage: npx ars review intent show <id>');
    process.exit(1);
  }

  const root = getRepoRoot();
  const record = readReviewIntent(id, root);
  console.log(JSON.stringify(record.intent, null, 2));
}

async function clearIntent(args: string[]): Promise<void> {
  const target = args[0];
  if (!target) {
    console.error('❌ Usage: npx ars review intent clear <id|all>');
    process.exit(1);
  }

  const root = getRepoRoot();

  if (target === 'all') {
    const records = markAllReviewIntentsProcessed(root);
    console.log(`✅ Marked ${records.length} review intent(s) as processed.`);
    return;
  }

  const record = markReviewIntentProcessed(target, root);
  console.log(`✅ Marked ${record.intent.id} as processed at ${record.intent.processedAt}.`);
}

async function createIntent(args: string[]): Promise<void> {
  const opts = parseCreateOptions(args);
  const root = getRepoRoot();
  const record = createReviewIntent({
    target: {
      series: opts.series,
      epId: opts.epId,
      stepId: opts.stepId,
    },
    source: {
      ui: opts.from,
      hash: opts.hash,
    },
    feedback: {
      kind: opts.kind,
      message: opts.message,
      severity: opts.severity,
    },
    attachments: opts.screenshotPath
      ? { screenshotPath: opts.screenshotPath }
      : undefined,
    rootDir: root,
  });

  console.log(`✅ Created review intent: ${record.intent.id}`);
  console.log(`   File: ${path.relative(root, record.filePath)}`);
}

function parseCreateOptions(args: string[]): ParsedCreateOptions {
  const values = new Map<string, string>();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      console.error(`❌ Unexpected argument: ${arg}`);
      process.exit(1);
    }

    const value = args[i + 1];
    if (!value || value.startsWith('--')) {
      console.error(`❌ Missing value for ${arg}`);
      process.exit(1);
    }

    values.set(arg.slice(2), value);
    i += 1;
  }

  const from = requiredValue(values, 'from');
  const kind = requiredValue(values, 'kind');
  const severity = requiredValue(values, 'severity');

  if (!SOURCE_UI_VALUES.has(from as ReviewIntentSource['ui'])) {
    console.error(`❌ Invalid --from: ${from}`);
    process.exit(1);
  }

  if (!FEEDBACK_KIND_VALUES.has(kind as ReviewIntentFeedback['kind'])) {
    console.error(`❌ Invalid --kind: ${kind}`);
    process.exit(1);
  }

  if (!FEEDBACK_SEVERITY_VALUES.has(severity as ReviewIntentFeedback['severity'])) {
    console.error(`❌ Invalid --severity: ${severity}`);
    process.exit(1);
  }

  return {
    from: from as ReviewIntentSource['ui'],
    series: requiredValue(values, 'series'),
    epId: requiredValue(values, 'ep'),
    stepId: requiredValue(values, 'step'),
    message: requiredValue(values, 'message'),
    kind: kind as ReviewIntentFeedback['kind'],
    severity: severity as ReviewIntentFeedback['severity'],
    hash: optionalValue(values, 'hash'),
    screenshotPath: optionalValue(values, 'screenshot-path'),
  };
}

function requiredValue(values: Map<string, string>, key: string): string {
  const value = values.get(key)?.trim();
  if (!value) {
    console.error(`❌ Missing required option --${key}`);
    process.exit(1);
  }

  return value;
}

function optionalValue(values: Map<string, string>, key: string): string | undefined {
  const value = values.get(key)?.trim();
  return value || undefined;
}
