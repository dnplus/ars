/**
 * @command prepare
 * @description Prepare publish context before upload.
 *
 * Usage:
 *   npx ars prepare youtube <epId>
 */
import fs from 'fs';
import path from 'path';
import type { Step } from '../../src/engine/shared/types';
import type { SubtitlePhrase } from '../../src/engine/shared/subtitle';
import { resolveEpisodeTarget } from '../lib/context';
import { loadEpisode, type LoadedEpisode } from '../lib/episode-file';
import { getRepoRoot } from '../lib/ars-config';

const ROOT = getRepoRoot();

const HELP = `
📝 ARS Prepare — Publish Context Preparation

Usage:
  npx ars prepare youtube <epId>

Options:
  --dry-run              Preview context/candidates without writing metadata back to episode

Notes:
  - prepare youtube writes prepare-youtube.md/json and does not call any LLM CLI.
  - After prepare youtube, run /ars:prepare-youtube <epId> in Claude Code.
`;

type PreparePhase = 'youtube';

interface PrepareOptions {
  phase: PreparePhase;
  series: string;
  epId: string;
  dryRun: boolean;
  apply: boolean;
  nonInteractive: boolean;
  ignoredFlags: string[];
}

interface StepContextSummary {
  id: string;
  heading: string;
  durationInSeconds: number;
  narrationSummary: string;
}

interface ChapterEntry {
  timestamp: string;
  label: string;
}

interface YoutubeCandidate {
  id: string;
  title: string;
  description: string;
  tags: string[];
  rationale: string;
  warnings: string[];
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
  chapters: ChapterEntry[];
  youtube: {
    candidates: YoutubeCandidate[];
    selected: string | null;
    title: string | null;
    description: string | null;
    tags: string[];
  };
  contextMarkdownPath: string;
  note: string;
}

function parseArgs(args: string[]): PrepareOptions {
  const phase = args[0];
  const target = args[1];

  if (!phase || !target || !['youtube'].includes(phase) || target.startsWith('--')) {
    console.log(HELP);
    process.exit(phase || target ? 1 : 0);
  }

  const { series, epId } = resolveEpisodeTarget(target, ROOT);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const nonInteractive = args.includes('--non-interactive');
  const ignoredFlags = ['--skip-llm', '--refresh', '--engine'].filter((flag) => args.includes(flag));

  if (apply) {
    console.error('❌ prepare youtube 不再直接回寫 metadata.youtube。請在 Claude Code 內執行 /ars:prepare-youtube。');
    process.exit(1);
  }

  return {
    phase: phase as PreparePhase,
    series,
    epId,
    dryRun,
    apply,
    nonInteractive,
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

function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stepHeading(step: Step): string {
  const stepData =
    step.data && typeof step.data === 'object' && !Array.isArray(step.data)
      ? (step.data as Record<string, unknown>)
      : {};
  const candidates = [
    step.title,
    stepData.title,
    stepData.cardTitle,
    step.phase,
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

function chapterLabelCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const firstLine = value
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return null;
  return previewText(firstLine, 32);
}

function chapterLabel(step: Step): string {
  const stepData =
    step.data && typeof step.data === 'object' && !Array.isArray(step.data)
      ? (step.data as Record<string, unknown>)
      : {};

  const candidates: unknown[] = [
    step.title,
    stepData.title,
    stepData.cardTitle,
    stepData.summaryTitle,
    stepData.cardContent,
    step.phase,
  ];

  for (const candidate of candidates) {
    const label = chapterLabelCandidate(candidate);
    if (label) return label;
  }

  if (step.id === 'intro') return '開場';
  if (step.id === 'ending') return '結尾';
  return step.id;
}

function actualStepDuration(
  step: Step,
  subtitles?: Record<string, SubtitlePhrase[]>,
): number {
  const phrases = subtitles?.[step.id];
  if (phrases && phrases.length > 0) {
    const last = phrases[phrases.length - 1];
    if (typeof last.endTime === 'number' && Number.isFinite(last.endTime) && last.endTime > 0) {
      return last.endTime;
    }
  }
  return step.durationInSeconds;
}

function buildChapters(
  steps: Step[],
  subtitles?: Record<string, SubtitlePhrase[]>,
): ChapterEntry[] {
  let cursor = 0;
  return steps.map((step) => {
    const entry = {
      timestamp: formatTimestamp(cursor),
      label: chapterLabel(step),
    };
    cursor += actualStepDuration(step, subtitles);
    return entry;
  });
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
    chapters: buildChapters(episode.episode.steps, episode.episode.subtitles),
    youtube: {
      candidates: [],
      selected: null,
      title: null,
      description: null,
      tags: [],
    },
    contextMarkdownPath,
    note: 'Claude Code /ars:prepare-youtube will fill youtube.candidates[] and the user picks one (youtube.selected), which flattens to youtube.title/description/tags.',
  };
}

function renderChaptersMarkdown(chapters: ChapterEntry[]): string {
  if (chapters.length === 0) return '_No chapters derived._';
  return chapters.map((chapter) => `- ${chapter.timestamp} ${chapter.label}`).join('\n');
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
    '## Chapters',
    '> 時間碼由 CLI 從 step durations（若已生音訊則從 subtitles 實際結束時間）推算。',
    '> /ars:prepare-youtube 應把此章節表原樣附在 description 末尾，不要重算時間。',
    '',
    renderChaptersMarkdown(artifact.chapters),
    '',
    '## TODO: YouTube Candidates',
    '> /ars:prepare-youtube 會在此產生 youtube-1 / youtube-2 / youtube-3 三個候選。',
    '> 每個候選需包含 Title / Tags / Rationale / Warnings / Description（description 末尾必含 Chapters 區塊）。',
    '> 使用者挑選後，skill 會把選中候選 flatten 到 artifact.youtube.title/description/tags 並將 status 設為 ready。',
    '',
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
    console.log(`   Chapters: ${artifact.chapters.length}`);
    console.log('\n   DRY RUN: artifacts were not written.');
    console.log(`   Planned Markdown: ${artifact.contextMarkdownPath}`);
    return;
  }

  const paths = writeYoutubePrepareArtifacts(options.series, options.epId, artifact);
  console.log(`\n📝 Prepare youtube: ${options.series}/${options.epId}`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`   Markdown: ${path.relative(ROOT, paths.markdownPath)}`);
  console.log(`   JSON: ${path.relative(ROOT, paths.jsonPath)}`);
  console.log(`   Chapters: ${artifact.chapters.length} derived`);
  console.log(`Context prepared. Run /ars:prepare-youtube ${options.series}/${options.epId} in Claude Code to generate candidates.`);
}

export async function run(args: string[]) {
  const options = parseArgs(args);
  showIgnoredFlagWarnings(options.ignoredFlags);

  const episode = await loadEpisode(options.series, options.epId);
  await runPrepareYoutube(options, episode);
}
