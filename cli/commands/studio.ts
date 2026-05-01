/**
 * @command studio
 * @description Open the Studio shell for a given episode (any phase) and
 *              manage StudioIntent records. Phase 1 entry point. The legacy
 *              `ars review open` will become a deprecation shim that forwards
 *              here in commit 8.
 */
import fs from 'fs';
import path from 'path';
import { resolveEpisodeTarget } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';
import { openStudio, type StudioPhase } from '../lib/studio-launcher';
import {
  createStudioIntent,
  getStudioIntentsDir,
  listStudioIntentRecords,
  markAllStudioIntentsProcessed,
  markStudioIntentProcessed,
  readStudioIntent,
  resolveStudioIntent,
  type StudioIntentRecord,
} from '../../src/studio/studio-intents';
import type {
  StudioIntentAnchorType,
  StudioIntentFeedback,
  StudioIntentResolution,
  StudioIntentSource,
} from '../../src/types/studio-intent';

const HELP = `
Usage: npx ars studio <epId> [--phase plan|build|review|slide] [--port <num>]
       npx ars studio intent <subcommand> [options]

Studio launcher:
  <epId>                                  Open Studio shell for the episode
  --phase plan|build|review|slide         Phase to open (default: plan)
  --port <num>                            Vite dev server port (default: 5174)

Intent subcommands:
  intent list [--pending] [--json]        List Studio intents grouped by status
  intent show <id>                        Print a Studio intent JSON payload
  intent clear <id|all>                   Mark Studio intents as processed
  intent resolve <id> [options]           Mark a Studio intent processed with resolution evidence
  intent create [options]                 Create a Studio intent
  intent watch                            Stream new intent filenames to stdout (one per line)

Intent create options:
  --from <studio|plan|build|review|prepare>
  --series <series>
  --ep <epId>
  --anchor-type <step|card|markdown-section|plan|episode>
  --anchor-id <id>
  --step <stepId>                         Shortcut: sets anchor-type=step, anchor-id=<stepId>
  --message <text>
  --kind <visual|content|timing|plan-section|build-trigger|prepare-generate|prepare-select|prepare-edit|other>
  --severity <low|medium|high>
  --hash <hash>
  --screenshot-path <path>

Intent resolve options:
  --summary <text>                        Required summary of the applied fix or no-op
  --processor <name>
  --changed-file <path>                   Repeatable
  --before <text>
  --after <text>
  --diff-path <path>
  --validation <text>
`;

const SOURCE_UI_VALUES = new Set<StudioIntentSource['ui']>(['studio', 'plan', 'build', 'review', 'prepare']);
const ANCHOR_TYPE_VALUES = new Set<StudioIntentAnchorType>(['step', 'card', 'markdown-section', 'plan', 'episode']);
const FEEDBACK_KIND_VALUES = new Set<StudioIntentFeedback['kind']>([
  'visual',
  'content',
  'timing',
  'plan-section',
  'build-trigger',
  'prepare-generate',
  'prepare-select',
  'prepare-edit',
  'prepare-trigger',
  'other',
]);
const FEEDBACK_SEVERITY_VALUES = new Set<StudioIntentFeedback['severity']>([
  'low',
  'medium',
  'high',
]);

const KNOWN_PHASES = new Set<StudioPhase>(['plan', 'build', 'review', 'slide']);

export async function run(args: string[]) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const [first, ...rest] = args;

  if (first === 'intent') {
    return handleIntent(rest);
  }

  return openStudioCommand(args);
}

async function openStudioCommand(args: string[]): Promise<void> {
  const positional: string[] = [];
  const opts = new Map<string, string>();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--phase' || arg === '--port') {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        console.error(`❌ Missing value for ${arg}`);
        process.exit(1);
      }
      opts.set(arg.slice(2), value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      console.error(`❌ Unknown option: ${arg}`);
      process.exit(1);
    }
    positional.push(arg);
  }

  const target = positional[0];
  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars studio <epId> [--phase plan|build|review|slide]');
    process.exit(1);
  }

  const root = getRepoRoot();
  const { series, epId } = resolveEpisodeTarget(target, root);

  const phaseRaw = opts.get('phase');
  const phase: StudioPhase = phaseRaw && KNOWN_PHASES.has(phaseRaw as StudioPhase)
    ? (phaseRaw as StudioPhase)
    : 'plan';
  if (phaseRaw && !KNOWN_PHASES.has(phaseRaw as StudioPhase)) {
    console.error(`❌ Invalid --phase: ${phaseRaw}`);
    process.exit(1);
  }

  const portRaw = opts.get('port');
  const port = portRaw ? Number(portRaw) : undefined;
  if (portRaw && Number.isNaN(port)) {
    console.error(`❌ Invalid --port: ${portRaw}`);
    process.exit(1);
  }

  openStudio({ series, epId, phase, port, rootDir: root });
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
    case 'resolve':
      return resolveIntent(rest);
    case 'create':
      return createIntent(rest);
    case 'watch':
      return watchIntents();
    default:
      console.error(`❌ Unknown studio intent subcommand: ${subcommand ?? '(missing)'}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function listIntents(args: string[]): Promise<void> {
  const root = getRepoRoot();
  const records = listStudioIntentRecords(root);
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

  console.log(`Studio inbox: ${path.relative(root, getStudioIntentsDir(root))}`);
  if (pendingOnly) {
    printIntentGroup('Pending', pending);
  } else {
    printIntentGroup('Pending', pending);
    printIntentGroup('Processed', processed);
  }
}

function printIntentGroup(title: string, records: StudioIntentRecord[]): void {
  console.log(`\n${title} (${records.length})`);
  if (records.length === 0) {
    console.log('  - none');
    return;
  }

  for (const { intent } of records) {
    const summary = [
      intent.id,
      `${intent.target.series}/${intent.target.epId}`,
      `anchor=${intent.target.anchorType}:${intent.target.anchorId}`,
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
    console.error('❌ Usage: npx ars studio intent show <id>');
    process.exit(1);
  }

  const root = getRepoRoot();
  const record = readStudioIntent(id, root);
  console.log(JSON.stringify(record.intent, null, 2));
}

async function clearIntent(args: string[]): Promise<void> {
  const target = args[0];
  if (!target) {
    console.error('❌ Usage: npx ars studio intent clear <id|all>');
    process.exit(1);
  }

  const root = getRepoRoot();

  if (target === 'all') {
    const records = markAllStudioIntentsProcessed(root);
    console.log(`✅ Marked ${records.length} studio intent(s) as processed.`);
    return;
  }

  const record = markStudioIntentProcessed(target, root);
  console.log(`✅ Marked ${record.intent.id} as processed at ${record.intent.processedAt}.`);
}

interface ParsedResolveOptions {
  id: string;
  resolution: Omit<StudioIntentResolution, 'processedAt'>;
}

async function resolveIntent(args: string[]): Promise<void> {
  const opts = parseResolveOptions(args);
  const root = getRepoRoot();
  const record = resolveStudioIntent(opts.id, opts.resolution, root);
  console.log(`✅ Resolved studio intent ${record.intent.id} at ${record.intent.processedAt}.`);
}

function parseResolveOptions(args: string[]): ParsedResolveOptions {
  const id = args[0];
  if (!id || id.startsWith('--')) {
    console.error('❌ Usage: npx ars studio intent resolve <id> --summary <text> [options]');
    process.exit(1);
  }

  const values = new Map<string, string>();
  const changedFiles: string[] = [];

  for (let i = 1; i < args.length; i += 1) {
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

    const key = arg.slice(2);
    if (key === 'changed-file') {
      changedFiles.push(value);
    } else {
      values.set(key, value);
    }
    i += 1;
  }

  const resolution: Omit<StudioIntentResolution, 'processedAt'> = {
    summary: requiredValue(values, 'summary'),
  };
  const processor = optionalValue(values, 'processor');
  const beforeExcerpt = optionalValue(values, 'before');
  const afterExcerpt = optionalValue(values, 'after');
  const diffPath = optionalValue(values, 'diff-path');
  const validation = optionalValue(values, 'validation');

  if (processor) resolution.processor = processor;
  if (changedFiles.length > 0) resolution.changedFiles = changedFiles;
  if (beforeExcerpt) resolution.beforeExcerpt = beforeExcerpt;
  if (afterExcerpt) resolution.afterExcerpt = afterExcerpt;
  if (diffPath) resolution.diffPath = diffPath;
  if (validation) resolution.validation = validation;

  return { id, resolution };
}

interface ParsedCreateOptions {
  from: StudioIntentSource['ui'];
  series: string;
  epId: string;
  anchorType: StudioIntentAnchorType;
  anchorId: string;
  message: string;
  kind: StudioIntentFeedback['kind'];
  severity: StudioIntentFeedback['severity'];
  hash?: string;
  screenshotPath?: string;
}

async function createIntent(args: string[]): Promise<void> {
  const opts = parseCreateOptions(args);
  const root = getRepoRoot();
  const record = createStudioIntent({
    target: {
      series: opts.series,
      epId: opts.epId,
      anchorType: opts.anchorType,
      anchorId: opts.anchorId,
      anchorMeta: opts.hash ? { hash: opts.hash } : undefined,
      stepId: opts.anchorType === 'step' ? opts.anchorId : undefined,
    },
    source: { ui: opts.from, hash: opts.hash },
    feedback: { kind: opts.kind, message: opts.message, severity: opts.severity },
    attachments: opts.screenshotPath ? { screenshotPath: opts.screenshotPath } : undefined,
    rootDir: root,
  });

  console.log(`✅ Created studio intent: ${record.intent.id}`);
  console.log(`   File: ${path.relative(root, record.filePath)}`);
}

async function watchIntents(): Promise<void> {
  const root = getRepoRoot();
  const dir = getStudioIntentsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.watch(dir, (_event, filename) => {
    if (filename && filename.endsWith('.json')) {
      process.stdout.write(`${filename}\n`);
    }
  });
  process.stdout.write('watching\n');
  await new Promise(() => {});
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

  if (!SOURCE_UI_VALUES.has(from as StudioIntentSource['ui'])) {
    console.error(`❌ Invalid --from: ${from}`);
    process.exit(1);
  }

  if (!FEEDBACK_KIND_VALUES.has(kind as StudioIntentFeedback['kind'])) {
    console.error(`❌ Invalid --kind: ${kind}`);
    process.exit(1);
  }

  if (!FEEDBACK_SEVERITY_VALUES.has(severity as StudioIntentFeedback['severity'])) {
    console.error(`❌ Invalid --severity: ${severity}`);
    process.exit(1);
  }

  // Anchor: --anchor-type + --anchor-id, or legacy shortcut --step
  let anchorType: StudioIntentAnchorType;
  let anchorId: string;
  const stepShortcut = optionalValue(values, 'step');
  const anchorTypeRaw = optionalValue(values, 'anchor-type');
  const anchorIdRaw = optionalValue(values, 'anchor-id');

  if (stepShortcut && !anchorTypeRaw) {
    anchorType = 'step';
    anchorId = stepShortcut;
  } else if (anchorTypeRaw && anchorIdRaw) {
    if (!ANCHOR_TYPE_VALUES.has(anchorTypeRaw as StudioIntentAnchorType)) {
      console.error(`❌ Invalid --anchor-type: ${anchorTypeRaw}`);
      process.exit(1);
    }
    anchorType = anchorTypeRaw as StudioIntentAnchorType;
    anchorId = anchorIdRaw;
  } else {
    console.error('❌ 需要 --anchor-type + --anchor-id，或舊式 --step。');
    process.exit(1);
  }

  return {
    from: from as StudioIntentSource['ui'],
    series: requiredValue(values, 'series'),
    epId: requiredValue(values, 'ep'),
    anchorType,
    anchorId,
    message: requiredValue(values, 'message'),
    kind: kind as StudioIntentFeedback['kind'],
    severity: severity as StudioIntentFeedback['severity'],
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
