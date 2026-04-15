/**
 * @command prepare
 * @description Prepare publish context before upload/pipeline.
 *
 * Usage:
 *   npx ars prepare youtube <series>/<epId>
 *   npx ars prepare social <series>/<epId>
 *   npx ars prepare social <series>/<epId> --apply --social social-1 --non-interactive
 */
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import * as ts from 'typescript';
import type { EpisodeMetadata, Step } from '../../src/engine/shared/types';
import { parseTarget } from '../lib/context';
import { loadEpisode, type LoadedEpisode } from '../lib/episode-file';

const ROOT = path.resolve(__dirname, '../..');

const HELP = `
📝 ARS Prepare — Publish Context Preparation

Usage:
  npx ars prepare youtube <series>/<epId>
  npx ars prepare social <series>/<epId>
  npx ars prepare social <series>/<epId> --apply --social social-1 --non-interactive

Options:
  --dry-run              Preview context/candidates without writing metadata back to episode
  --apply                Write selected social candidate back to episode metadata
  --social <id>          Selected social candidate id (social phase)
  --non-interactive      Skip readline prompts; requires --apply + --social

Notes:
  - prepare youtube writes prepare-youtube.md/json and does not call any LLM CLI.
  - After prepare youtube, run /ars:prepare-youtube <series>/<epId> in Claude Code.
  - prepare social keeps a heuristic-only review/apply flow in core.
`;

type PreparePhase = 'youtube' | 'social';

interface PrepareOptions {
  phase: PreparePhase;
  series: string;
  epId: string;
  dryRun: boolean;
  apply: boolean;
  nonInteractive: boolean;
  socialCandidateId?: string;
  ignoredFlags: string[];
}

interface StepContextSummary {
  id: string;
  heading: string;
  durationInSeconds: number;
  narrationSummary: string;
}

interface YoutubePrepareArtifact {
  phase: 'youtube';
  status: 'pending-review' | 'ready';
  generatedAt: string;
  target: {
    series: string;
    epId: string;
  };
  episode: {
    filePath: string;
    title: string;
    subtitle: string | null;
    totalSteps: number;
    totalDurationInSeconds: number;
  };
  steps: StepContextSummary[];
  youtube: {
    title: string | null;
    description: string | null;
    tags: string[];
  };
  contextMarkdownPath: string;
  note: string;
}

interface CandidateChecks {
  warnings: string[];
  blockers: string[];
}

interface SocialCandidate {
  id: string;
  posts: string[];
  imageAssets: string[];
  rationale: string;
  checks: CandidateChecks;
}

interface SocialPrepareArtifact {
  phase: 'social';
  status: 'review-ready' | 'applied';
  generatedAt: string;
  target: {
    series: string;
    epId: string;
  };
  selectedSocialCandidateId: string | null;
  social: {
    candidates: SocialCandidate[];
  };
  checks: CandidateChecks;
  applied: boolean;
}

function parseArgs(args: string[]): PrepareOptions {
  const phase = args[0];
  const target = args[1];

  if (!phase || !target || !['youtube', 'social'].includes(phase) || target.startsWith('--')) {
    console.log(HELP);
    process.exit(phase || target ? 1 : 0);
  }

  const { series, epId } = parseTarget(target);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const nonInteractive = args.includes('--non-interactive');
  const socialIdx = args.indexOf('--social');
  const socialCandidateId = socialIdx !== -1 ? args[socialIdx + 1] : undefined;
  const ignoredFlags = ['--skip-llm', '--refresh', '--engine'].filter((flag) => args.includes(flag));

  if (phase === 'youtube' && apply) {
    console.error('❌ prepare youtube 不再直接回寫 metadata.youtube。請在 Claude Code 內執行 /ars:prepare-youtube。');
    process.exit(1);
  }

  if (phase === 'social' && nonInteractive && (!apply || !socialCandidateId)) {
    console.error('❌ --non-interactive 需要搭配 --apply 與 --social <id>');
    process.exit(1);
  }

  return {
    phase: phase as PreparePhase,
    series,
    epId,
    dryRun,
    apply,
    nonInteractive,
    socialCandidateId,
    ignoredFlags,
  };
}

function previewText(text: string, max = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stepHeading(step: Step): string {
  const stepData = step as unknown as Record<string, unknown>;
  const candidates = [
    stepData.title,
    stepData.cardTitle,
    stepData.imageTitle,
    stepData.windowTitle,
    stepData.summaryTitle,
    stepData.mermaidTitle,
    stepData.phase,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return previewText(candidate, 80);
    }
  }

  if (step.id === 'intro') return '開場';
  if (step.id === 'ending') return '結尾';
  return step.id;
}

function summarizeSteps(steps: Step[]): StepContextSummary[] {
  return steps.map((step) => ({
    id: step.id,
    heading: stepHeading(step),
    durationInSeconds: step.durationInSeconds,
    narrationSummary: previewText(step.narration, 220),
  }));
}

function buildYoutubePrepareArtifact(episode: LoadedEpisode): YoutubePrepareArtifact {
  const totalDurationInSeconds = episode.episode.steps.reduce(
    (sum, step) => sum + step.durationInSeconds,
    0,
  );
  const contextMarkdownPath = path.join(
    'output',
    'publish',
    episode.series,
    episode.epId,
    'prepare-youtube.md',
  );

  return {
    phase: 'youtube',
    status: 'pending-review',
    generatedAt: new Date().toISOString(),
    target: {
      series: episode.series,
      epId: episode.epId,
    },
    episode: {
      filePath: path.relative(ROOT, episode.filePath),
      title: episode.metadata.title,
      subtitle: episode.metadata.subtitle ?? null,
      totalSteps: episode.episode.steps.length,
      totalDurationInSeconds,
    },
    steps: summarizeSteps(episode.episode.steps),
    youtube: {
      title: null,
      description: null,
      tags: [],
    },
    contextMarkdownPath,
    note: 'Claude Code will fill youtube.title / youtube.description / youtube.tags via /ars:prepare-youtube.',
  };
}

function buildYoutubePrepareMarkdown(artifact: YoutubePrepareArtifact): string {
  const subtitle = artifact.episode.subtitle ?? '(none)';
  const stepsSection = artifact.steps.length > 0
    ? artifact.steps.map((step, index) => [
        `### ${index + 1}. ${step.heading}`,
        `- Step ID: ${step.id}`,
        `- Duration: ${formatDuration(step.durationInSeconds)}`,
        `- Narration Summary: ${step.narrationSummary}`,
      ].join('\n')).join('\n\n')
    : '_No steps found._';

  return [
    `# YouTube Prepare Context — ${artifact.target.series}/${artifact.target.epId}`,
    '',
    '## Episode Info',
    `- Series: ${artifact.target.series}`,
    `- Episode ID: ${artifact.target.epId}`,
    `- Episode File: ${artifact.episode.filePath}`,
    `- Title: ${artifact.episode.title}`,
    `- Subtitle: ${subtitle}`,
    `- Total Steps: ${artifact.episode.totalSteps}`,
    `- Estimated Duration: ${formatDuration(artifact.episode.totalDurationInSeconds)}`,
    '',
    '## Steps Summary',
    stepsSection,
    '',
    '## TODO: YouTube Title',
    'TODO: Claude Code will fill this via /ars:prepare-youtube skill.',
    '',
    '## TODO: YouTube Description',
    'TODO: Claude Code will fill this via /ars:prepare-youtube skill.',
    '',
    '## TODO: YouTube Tags',
    'TODO: Claude Code will fill this via /ars:prepare-youtube skill.',
    '',
  ].join('\n');
}

function writeYoutubePrepareArtifacts(
  series: string,
  epId: string,
  artifact: YoutubePrepareArtifact,
): { jsonPath: string; markdownPath: string } {
  const outDir = path.join(ROOT, 'output', 'publish', series, epId);
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'prepare-youtube.json');
  const markdownPath = path.join(outDir, 'prepare-youtube.md');

  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(markdownPath, buildYoutubePrepareMarkdown(artifact), 'utf-8');

  return { jsonPath, markdownPath };
}

function getPublishedYoutubeUrl(metadata: EpisodeMetadata): string | null {
  return metadata.publish?.youtubeUrl?.trim() || null;
}

function buildHeuristicSocialCandidates(metadata: EpisodeMetadata): SocialCandidate[] {
  const title = metadata.title.trim();
  const subtitle = metadata.subtitle?.trim();
  const youtubeUrl = getPublishedYoutubeUrl(metadata);
  const linkTail = youtubeUrl ? `\n\n完整版影片：${youtubeUrl}` : '';

  const variants = [
    {
      primary: `${title}\n\n這集我把重點拆成比較好消化的版本。${subtitle ? `\n${subtitle}` : ''}\n\n如果你想直接抓結論跟脈絡，可以先看這支。${linkTail}`,
      reply1: '如果你也在處理類似題目，最值得先釐清的是你真正要解的問題是什麼。',
      reply2: '想看我把其中一段再拆成短版的話，可以直接留言。',
      rationale: '標準版本，保留原始主題與清楚 CTA。',
    },
    {
      primary: `${title}\n\n如果你最近也在想「這東西到底值不值得花時間搞懂」，這支可以先看。\n\n我把脈絡、取捨跟實際影響都整理進去了。${linkTail}`,
      reply1: '很多題目不是資訊不夠，而是被講得太抽象，反而難判斷。',
      reply2: '你最想我接著展開哪個角度？',
      rationale: '偏問題導向，適合比較廣的受眾。',
    },
    {
      primary: `${title}\n\n${subtitle ? `${subtitle}\n\n` : ''}這題我原本只想講一個點，最後發現還是得把整個脈絡拆開才說得清楚。${linkTail}`,
      reply1: '真正有差的地方通常不在功能表，而在你怎麼拿它做判斷。',
      reply2: '如果表現不錯，我會把裡面最有感的段落切成短版。',
      rationale: '偏 creator 語氣，讀起來比較像本人發文。',
    },
  ];

  return variants.map((variant, index) => ({
    id: `social-${index + 1}`,
    posts: [variant.primary, variant.reply1, variant.reply2],
    imageAssets: [],
    rationale: variant.rationale,
    checks: { warnings: [], blockers: [] },
  }));
}

function resolveRepoRelativeImagePath(
  imagePath: string,
  root: string,
): { resolvedPath: string | null; issue?: string } {
  if (path.isAbsolute(imagePath)) {
    return fs.existsSync(imagePath)
      ? { resolvedPath: imagePath }
      : { resolvedPath: null, issue: `找不到 imageAssets 檔案：${imagePath}` };
  }

  const resolvedPath = path.resolve(root, imagePath);
  const relative = path.relative(root, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      resolvedPath: null,
      issue: `imageAssets 相對路徑必須以 repo root 為基準：${imagePath}`,
    };
  }

  return fs.existsSync(resolvedPath)
    ? { resolvedPath }
    : { resolvedPath: null, issue: `找不到 imageAssets 檔案：${imagePath}` };
}

function validateSocialCandidate(candidate: SocialCandidate, root: string): CandidateChecks {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (candidate.posts.length === 0) {
    blockers.push(`${candidate.id}: social.posts 不可為空`);
  }

  const primary = candidate.posts[0] ?? '';
  if (primary.length > 500) {
    blockers.push(`${candidate.id}: social.posts[0] 超過 500 字，Threads 無法發文`);
  } else if (primary.length < 40) {
    warnings.push(`${candidate.id}: social.posts[0] 偏短，主文可能不夠完整`);
  }

  for (const imagePath of candidate.imageAssets) {
    const resolved = resolveRepoRelativeImagePath(imagePath, root);
    if (resolved.issue) blockers.push(`${candidate.id}: ${resolved.issue}`);
  }

  return { warnings, blockers };
}

function mergeChecks(...checksList: CandidateChecks[]): CandidateChecks {
  return {
    warnings: Array.from(new Set(checksList.flatMap((checks) => checks.warnings))),
    blockers: Array.from(new Set(checksList.flatMap((checks) => checks.blockers))),
  };
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function chooseCandidateId<T extends { id: string }>(label: string, candidates: T[]): Promise<string> {
  while (true) {
    const answer = await prompt(`Select ${label} candidate [1-${candidates.length}] (default 1): `);
    if (!answer) return candidates[0].id;

    const byNumber = Number(answer);
    if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= candidates.length) {
      return candidates[byNumber - 1].id;
    }

    const byId = candidates.find((candidate) => candidate.id === answer);
    if (byId) return byId.id;

    console.log(`   ⚠️  Invalid selection: ${answer}`);
  }
}

function getSelectedCandidate<T extends { id: string }>(candidates: T[], candidateId: string, label: string): T {
  const candidate = candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    console.error(`❌ Unknown ${label} candidate: ${candidateId}`);
    process.exit(1);
  }
  return candidate;
}

function buildSocialPrepareMarkdown(artifact: SocialPrepareArtifact): string {
  const warnings = artifact.checks.warnings.length > 0
    ? artifact.checks.warnings.map((item) => `- ${item}`).join('\n')
    : '- None';
  const blockers = artifact.checks.blockers.length > 0
    ? artifact.checks.blockers.map((item) => `- ${item}`).join('\n')
    : '- None';

  const candidates = artifact.social.candidates.map((candidate) => [
    `## ${candidate.id}`,
    '',
    `- Image assets: ${candidate.imageAssets.join(', ') || '(default cover)'}`,
    `- Rationale: ${candidate.rationale}`,
    `- Warnings: ${candidate.checks.warnings.length ? candidate.checks.warnings.join(' | ') : 'None'}`,
    `- Blockers: ${candidate.checks.blockers.length ? candidate.checks.blockers.join(' | ') : 'None'}`,
    '',
    ...candidate.posts.map((post, index) => [
      `### Post ${index}`,
      '',
      '```text',
      post,
      '```',
    ].join('\n')),
  ].join('\n')).join('\n\n');

  return [
    `# Social Prepare Review — ${artifact.target.series}/${artifact.target.epId}`,
    '',
    `- Status: ${artifact.status}`,
    `- Generated at: ${artifact.generatedAt}`,
    `- Selected Social: ${artifact.selectedSocialCandidateId ?? '(not selected)'}`,
    `- Applied: ${artifact.applied ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    '### Warnings',
    warnings,
    '',
    '### Blockers',
    blockers,
    '',
    '# Social Candidates',
    '',
    candidates,
    '',
  ].join('\n');
}

function writeSocialPrepareArtifacts(
  series: string,
  epId: string,
  artifact: SocialPrepareArtifact,
): { jsonPath: string; markdownPath: string } {
  const outDir = path.join(ROOT, 'output', 'publish', series, epId);
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'prepare-social.json');
  const markdownPath = path.join(outDir, 'prepare-social.md');

  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(markdownPath, buildSocialPrepareMarkdown(artifact), 'utf-8');

  return { jsonPath, markdownPath };
}

function createStringNode(value: string): ts.Expression {
  if (value.includes('\n')) {
    return ts.factory.createNoSubstitutionTemplateLiteral(value.replace(/\$\{/g, '\\${'));
  }

  return ts.factory.createStringLiteral(value);
}

function createStringArrayNode(values: string[]): ts.ArrayLiteralExpression {
  return ts.factory.createArrayLiteralExpression(values.map((value) => createStringNode(value)), true);
}

function createSocialProperty(social: Pick<SocialCandidate, 'posts' | 'imageAssets'>): ts.PropertyAssignment {
  const properties: ts.ObjectLiteralElementLike[] = [
    ts.factory.createPropertyAssignment('posts', createStringArrayNode(social.posts)),
  ];

  if (social.imageAssets.length > 0) {
    properties.push(
      ts.factory.createPropertyAssignment('imageAssets', createStringArrayNode(social.imageAssets)),
    );
  }

  return ts.factory.createPropertyAssignment(
    'social',
    ts.factory.createObjectLiteralExpression(properties, true),
  );
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function getLineIndent(sourceText: string, position: number): string {
  const lineStart = sourceText.lastIndexOf('\n', position) + 1;
  const match = sourceText.slice(lineStart).match(/^\s*/);
  return match?.[0] ?? '';
}

function reindentPrintedObject(printed: string, baseIndent: string): string {
  const baseIndentWidth = baseIndent.length;
  return printed
    .split('\n')
    .map((line, index) => {
      if (index === 0) return line;
      const leading = line.match(/^\s*/)?.[0].length ?? 0;
      const content = line.slice(leading);
      const desiredIndent = baseIndentWidth + Math.floor(leading / 2);
      return `${' '.repeat(desiredIndent)}${content}`;
    })
    .join('\n');
}

function updateEpisodeSocialMetadata(
  sourceText: string,
  filePath: string,
  social: Pick<SocialCandidate, 'posts' | 'imageAssets'>,
): string {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let metadataObject: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node): void => {
    if (
      !metadataObject &&
      ts.isPropertyAssignment(node) &&
      getPropertyNameText(node.name) === 'metadata' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      metadataObject = node.initializer;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!metadataObject) {
    throw new Error(`metadata object not found in ${filePath}`);
  }

  const resolvedMetadataObject = metadataObject as ts.ObjectLiteralExpression;
  const keptProperties = resolvedMetadataObject.properties.filter((property: ts.ObjectLiteralElementLike) => {
    const propertyName = ts.isPropertyAssignment(property) ? getPropertyNameText(property.name) ?? '' : '';
    return !(ts.isPropertyAssignment(property) && propertyName === 'social');
  });

  const nextMetadata = ts.factory.createObjectLiteralExpression([
    ...keptProperties,
    createSocialProperty(social),
  ], true);

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const baseIndent = getLineIndent(sourceText, resolvedMetadataObject.getStart(sourceFile));
  const printed = reindentPrintedObject(
    printer.printNode(ts.EmitHint.Expression, nextMetadata, sourceFile),
    baseIndent,
  );

  return `${sourceText.slice(0, resolvedMetadataObject.getStart(sourceFile))}${printed}${sourceText.slice(resolvedMetadataObject.getEnd())}`;
}

function showIgnoredFlagWarnings(flags: string[]): void {
  if (flags.length === 0) return;
  console.warn(`⚠️  Ignoring legacy LLM flags: ${flags.join(', ')}`);
  console.warn('   Core prepare no longer invokes any LLM CLI.');
}

async function runPrepareYoutube(options: PrepareOptions, episode: LoadedEpisode): Promise<void> {
  const artifact = buildYoutubePrepareArtifact(episode);

  if (options.dryRun) {
    console.log(`\n📝 Prepare youtube: ${options.series}/${options.epId}`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`   Title: ${artifact.episode.title}`);
    console.log(`   Subtitle: ${artifact.episode.subtitle ?? '(none)'}`);
    console.log(`   Steps: ${artifact.episode.totalSteps}`);
    console.log(`   Duration: ${formatDuration(artifact.episode.totalDurationInSeconds)}`);
    console.log('\n   DRY RUN: artifacts were not written.');
    console.log(`   Planned Markdown: ${artifact.contextMarkdownPath}`);
    return;
  }

  const paths = writeYoutubePrepareArtifacts(options.series, options.epId, artifact);
  console.log(`\n📝 Prepare youtube: ${options.series}/${options.epId}`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`   Markdown: ${path.relative(ROOT, paths.markdownPath)}`);
  console.log(`   JSON: ${path.relative(ROOT, paths.jsonPath)}`);
  console.log(`Context prepared. Run /ars:prepare-youtube ${options.series}/${options.epId} in Claude Code to generate YouTube metadata.`);
}

async function runPrepareSocial(options: PrepareOptions, episode: LoadedEpisode): Promise<void> {
  console.log(`\n🧵 Prepare social: ${options.series}/${options.epId}`);
  console.log(`${'═'.repeat(50)}`);

  const phaseChecks = getPublishedYoutubeUrl(episode.metadata)
    ? { warnings: [], blockers: [] }
    : {
        warnings: [],
        blockers: [
          'prepare social 需要先有 metadata.publish.youtubeUrl。請先 upload youtube，讓系統回寫真實影片網址。',
        ],
      };

  const candidates = buildHeuristicSocialCandidates(episode.metadata).map((candidate) => ({
    ...candidate,
    checks: validateSocialCandidate(candidate, episode.root),
  }));

  let artifact: SocialPrepareArtifact = {
    phase: 'social',
    status: 'review-ready',
    generatedAt: new Date().toISOString(),
    target: {
      series: options.series,
      epId: options.epId,
    },
    selectedSocialCandidateId: null,
    social: {
      candidates,
    },
    checks: phaseChecks,
    applied: false,
  };

  let paths = writeSocialPrepareArtifacts(options.series, options.epId, artifact);
  console.log(`   Review Markdown: ${path.relative(ROOT, paths.markdownPath)}`);
  console.log(`   Review JSON: ${path.relative(ROOT, paths.jsonPath)}`);

  if (artifact.checks.blockers.length > 0) {
    console.log('\n❌ Blockers');
    for (const blocker of artifact.checks.blockers) {
      console.log(`   • ${blocker}`);
    }
    process.exit(1);
  }

  for (const candidate of candidates) {
    console.log(`   ${candidate.id}  ${previewText(candidate.posts[0] ?? '', 100)}`);
  }

  if (options.dryRun && !options.apply) {
    console.log('\n   🏜️  Dry run — review artifact generated only');
    return;
  }

  let selectedId = options.socialCandidateId ?? candidates[0]?.id ?? null;
  if (!selectedId) {
    console.error('❌ No social candidates generated.');
    process.exit(1);
  }

  if (!options.nonInteractive) {
    selectedId = await chooseCandidateId('social', candidates);
  }

  const selected = getSelectedCandidate(candidates, selectedId, 'social');
  artifact.selectedSocialCandidateId = selected.id;
  artifact.checks = mergeChecks(artifact.checks, selected.checks);
  paths = writeSocialPrepareArtifacts(options.series, options.epId, artifact);

  if (artifact.checks.warnings.length > 0) {
    console.log('\n⚠️  Warnings');
    for (const warning of artifact.checks.warnings) {
      console.log(`   • ${warning}`);
    }
  }

  if (artifact.checks.blockers.length > 0) {
    console.log('\n❌ Blockers');
    for (const blocker of artifact.checks.blockers) {
      console.log(`   • ${blocker}`);
    }
    process.exit(1);
  }

  let shouldApply = options.apply;
  if (!options.nonInteractive) {
    const confirmation = await prompt('Apply selected social metadata to episode? [y/N] ');
    shouldApply = confirmation === 'y' || confirmation === 'yes';
  }

  if (!shouldApply) {
    console.log(`\n   Metadata not written. Review artifact: ${path.relative(ROOT, paths.markdownPath)}`);
    return;
  }

  const nextSource = updateEpisodeSocialMetadata(episode.sourceText, episode.filePath, selected);
  fs.writeFileSync(episode.filePath, nextSource, 'utf-8');

  artifact.applied = true;
  artifact.status = 'applied';
  paths = writeSocialPrepareArtifacts(options.series, options.epId, artifact);

  console.log(`\n✅ Social metadata updated: ${path.relative(ROOT, episode.filePath)}`);
  console.log(`   Review artifact: ${path.relative(ROOT, paths.markdownPath)}`);
}

export async function run(args: string[]) {
  const options = parseArgs(args);
  showIgnoredFlagWarnings(options.ignoredFlags);

  const episode = await loadEpisode(options.series, options.epId);
  if (options.phase === 'youtube') {
    await runPrepareYoutube(options, episode);
    return;
  }

  await runPrepareSocial(options, episode);
}
