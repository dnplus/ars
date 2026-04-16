import fs from 'fs';
import path from 'path';

const WORKSTATE_VERSION = 1;
const STALE_WORKSTATE_MS = 14 * 24 * 60 * 60 * 1000;
const EP_ID_PATTERN = /\bep[a-z0-9-]+\b/gi;

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function dirHasFiles(dirPath, matcher) {
  try {
    return fs.readdirSync(dirPath).some((name) => matcher(name));
  } catch {
    return false;
  }
}

function listMatchingFiles(dirPath, matcher) {
  try {
    return fs.readdirSync(dirPath).filter((name) => matcher(name));
  } catch {
    return [];
  }
}

function collectDirMtime(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  let latest = fileMtime(dirPath);
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = path.join(dirPath, entry.name);
      latest = Math.max(
        latest,
        entry.isDirectory() ? collectDirMtime(entryPath) : fileMtime(entryPath),
      );
    }
  } catch {
    return latest;
  }
  return latest;
}

function normalizePromptText(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizePromptText).join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.values(value).map(normalizePromptText).join('\n');
  }
  return '';
}

function parseTarget(target, activeSeries) {
  if (!target || typeof target !== 'string') {
    return null;
  }
  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes('/')) {
    const slashIndex = trimmed.indexOf('/');
    const seriesId = trimmed.slice(0, slashIndex);
    const episodeId = trimmed.slice(slashIndex + 1);
    if (!seriesId || !episodeId) {
      return null;
    }
    return { seriesId, episodeId };
  }
  if (!activeSeries) {
    return null;
  }
  return { seriesId: activeSeries, episodeId: trimmed };
}

export function readStdin(timeoutMs = 250) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish(Buffer.concat(chunks).toString('utf8'));
    }, timeoutMs);

    process.stdin.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    process.stdin.on('end', () => {
      finish(Buffer.concat(chunks).toString('utf8'));
    });
    process.stdin.on('error', () => {
      finish('');
    });

    if (process.stdin.readableEnded) {
      finish(Buffer.concat(chunks).toString('utf8'));
    }
  });
}

export function parseHookPayload(raw) {
  if (!raw || !raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getRepoRoot(cwd = process.cwd()) {
  return cwd;
}

export function getArsConfig(root = process.cwd()) {
  return readJson(path.join(root, '.ars', 'config.json'));
}

export function getActiveSeries(root = process.cwd()) {
  const config = getArsConfig(root);
  const activeSeries = config?.project?.activeSeries;
  if (typeof activeSeries === 'string' && activeSeries.trim()) {
    return activeSeries.trim();
  }
  return null;
}

export function getWorkStatePaths(root = process.cwd(), sessionId) {
  const stateRoot = path.join(root, '.ars', 'state');
  const repoPath = path.join(stateRoot, 'workstate.json');
  const sessionPath = sessionId
    ? path.join(stateRoot, 'sessions', sessionId, 'workstate.json')
    : null;
  return { repoPath, sessionPath };
}

function isFreshWorkState(state) {
  if (!state?.active || typeof state.updatedAt !== 'string') {
    return false;
  }
  const updatedAtMs = new Date(state.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) {
    return false;
  }
  return Date.now() - updatedAtMs <= STALE_WORKSTATE_MS;
}

export function readWorkState(root = process.cwd(), sessionId) {
  const { repoPath, sessionPath } = getWorkStatePaths(root, sessionId);

  const candidates = [
    sessionPath ? readJson(sessionPath) : null,
    readJson(repoPath),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate?.version === WORKSTATE_VERSION && isFreshWorkState(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function writeWorkState(
  root = process.cwd(),
  sessionId,
  input,
) {
  const timestamp = new Date().toISOString();
  const next = {
    version: WORKSTATE_VERSION,
    active: true,
    ...input,
    updatedAt: timestamp,
  };
  const { repoPath, sessionPath } = getWorkStatePaths(root, sessionId);
  writeJson(repoPath, next);
  if (sessionPath) {
    writeJson(sessionPath, next);
  }
  return next;
}

export function listEpisodeIds(root = process.cwd(), seriesId) {
  if (!seriesId) {
    return [];
  }

  const sourceDir = path.join(root, 'src', 'episodes', seriesId);
  const planningDir = path.join(root, '.ars', 'episodes');
  const ids = new Set();

  if (fs.existsSync(sourceDir)) {
    for (const name of fs.readdirSync(sourceDir)) {
      if (name.startsWith('ep') && name.endsWith('.ts') && !name.includes('.subtitles.') && !name.includes('.template.')) {
        ids.add(name.replace(/\.ts$/, ''));
      }
    }
  }

  if (fs.existsSync(planningDir)) {
    for (const entry of fs.readdirSync(planningDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('ep')) {
        ids.add(entry.name);
      }
    }
  }

  return Array.from(ids).sort();
}

export function getPendingReviewCounts(root = process.cwd(), seriesId) {
  const reviewDir = path.join(root, '.ars', 'review-intents');
  const counts = new Map();

  if (!fs.existsSync(reviewDir)) {
    return counts;
  }

  for (const fileName of listMatchingFiles(reviewDir, (name) => name.endsWith('.json'))) {
    const record = readJson(path.join(reviewDir, fileName));
    const targetSeries = record?.target?.series;
    const epId = record?.target?.epId;
    if (typeof targetSeries !== 'string' || typeof epId !== 'string') {
      continue;
    }
    if (seriesId && targetSeries !== seriesId) {
      continue;
    }
    if (record?.processedAt) {
      continue;
    }
    counts.set(epId, (counts.get(epId) ?? 0) + 1);
  }

  return counts;
}

export function detectEpisodeProgress(root = process.cwd(), seriesId, episodeId) {
  const planDir = path.join(root, '.ars', 'episodes', episodeId);
  const cardSpecsDir = path.join(planDir, 'card-specs');
  const sourceFile = path.join(root, 'src', 'episodes', seriesId, `${episodeId}.ts`);
  const subtitlesFile = path.join(root, 'src', 'episodes', seriesId, `${episodeId}.subtitles.ts`);
  const audioDir = path.join(root, 'public', 'episodes', seriesId, episodeId, 'audio');
  const prepareDir = path.join(root, 'output', 'publish', seriesId, episodeId);
  const renderFile = path.join(root, 'output', 'render', seriesId, `${episodeId}.mp4`);
  const coverFile = path.join(root, 'output', 'covers', seriesId, `${episodeId}.jpg`);
  const pendingReview = getPendingReviewCounts(root, seriesId).get(episodeId) ?? 0;

  const hasTopic = fs.existsSync(path.join(planDir, 'topic.md'));
  const hasPlan = fs.existsSync(path.join(planDir, 'plan.md'));
  const cardSpecBriefs = listMatchingFiles(cardSpecsDir, (name) => name.endsWith('.md'));
  const pendingCardSpec = cardSpecBriefs.length;
  const hasSource = fs.existsSync(sourceFile);
  const hasSubtitles = fs.existsSync(subtitlesFile);
  const audioFiles = listMatchingFiles(audioDir, (name) => name.endsWith('.mp3'));
  const hasAudio = audioFiles.length > 0;
  const hasPrepareYoutube =
    fs.existsSync(path.join(prepareDir, 'prepare-youtube.json')) ||
    fs.existsSync(path.join(prepareDir, 'prepare-youtube.md'));
  const hasRender = fs.existsSync(renderFile);
  const hasCover = fs.existsSync(coverFile);

  const stage = pendingReview > 0
    ? 'review'
    : pendingCardSpec > 0
      ? 'card-spec'
    : hasPrepareYoutube
      ? 'prepare-youtube'
      : hasRender || hasCover
        ? 'package'
        : hasSubtitles || hasAudio
          ? 'audio'
          : hasSource && hasPlan
          ? 'build'
          : hasPlan || hasTopic
              ? 'plan'
                : hasSource
                  ? 'draft'
                  : 'idle';

  const nextAction = pendingReview > 0
    ? '/ars:apply-review latest'
    : pendingCardSpec > 0
      ? '/ars:new-card <type>'
    : hasPrepareYoutube
      ? `/ars:publish-youtube ${episodeId}`
      : hasRender || hasCover
        ? `npx ars prepare youtube ${episodeId}`
        : hasSubtitles || hasAudio
          ? `npx ars prepare youtube ${episodeId}`
          : hasSource && hasPlan
          ? `/ars:review-open ${episodeId}`
          : hasPlan || hasTopic
              ? `/ars:build ${episodeId}`
                : hasSource
                  ? `/ars:plan ${episodeId}`
                : `/ars:episode-create ${episodeId}`;

  const lastModifiedAtMs = Math.max(
    fileMtime(sourceFile),
    fileMtime(subtitlesFile),
    collectDirMtime(planDir),
    collectDirMtime(audioDir),
    collectDirMtime(prepareDir),
    fileMtime(renderFile),
    fileMtime(coverFile),
  );

  return {
    seriesId,
    episodeId,
    stage,
    nextAction,
    pendingReview,
    hasTopic,
    hasPlan,
    pendingCardSpec,
    hasSource,
    hasSubtitles,
    audioCount: audioFiles.length,
    hasPrepareYoutube,
    hasRender,
    hasCover,
    lastModifiedAtMs,
  };
}

export function detectCurrentEpisode(root = process.cwd(), seriesId, preferredEpisodeId) {
  const episodeIds = listEpisodeIds(root, seriesId);
  if (preferredEpisodeId && !episodeIds.includes(preferredEpisodeId)) {
    episodeIds.unshift(preferredEpisodeId);
  }
  if (episodeIds.length === 0) {
    return null;
  }

  const progressList = Array.from(new Set(episodeIds))
    .map((episodeId) => detectEpisodeProgress(root, seriesId, episodeId))
    .sort((left, right) => {
      if (left.pendingReview !== right.pendingReview) {
        return right.pendingReview - left.pendingReview;
      }
      return right.lastModifiedAtMs - left.lastModifiedAtMs;
    });

  return progressList[0] ?? null;
}

export function getCurrentEpisodeSummary(root = process.cwd(), sessionId) {
  const activeSeries = getActiveSeries(root);
  if (!activeSeries) {
    return {
      activeSeries: null,
      progress: null,
      workState: null,
    };
  }

  const workState = readWorkState(root, sessionId);
  const preferredEpisodeId =
    workState?.seriesId === activeSeries ? workState.episodeId : null;
  const progress = preferredEpisodeId
    ? detectEpisodeProgress(root, activeSeries, preferredEpisodeId)
    : detectCurrentEpisode(root, activeSeries, null);

  return {
    activeSeries,
    progress,
    workState,
  };
}

export function formatProgressLine(progress) {
  if (!progress) {
    return null;
  }

  const parts = [
    `${progress.episodeId}`,
    `stage=${progress.stage}`,
  ];

  if (progress.pendingReview > 0) {
    parts.push(`review=${progress.pendingReview}`);
  }
  if (progress.pendingCardSpec > 0) {
    parts.push(`card-spec=${progress.pendingCardSpec}`);
  }
  if (progress.hasPlan) {
    parts.push('plan');
  }
  if (progress.hasSource) {
    parts.push('source');
  }
  if (progress.audioCount > 0) {
    parts.push(`audio=${progress.audioCount}`);
  }
  if (progress.hasSubtitles) {
    parts.push('subs');
  }
  if (progress.hasPrepareYoutube) {
    parts.push('prepare');
  }
  if (progress.hasRender) {
    parts.push('render');
  }

  return parts.join(' | ');
}

export function formatChecklistLine(progress) {
  if (!progress) {
    return null;
  }

  const checklist = [
    `topic:${progress.hasTopic ? 'yes' : 'no'}`,
    `plan:${progress.hasPlan ? 'yes' : 'no'}`,
    `src:${progress.hasSource ? 'yes' : 'no'}`,
    `audio:${progress.audioCount}`,
    `subs:${progress.hasSubtitles ? 'yes' : 'no'}`,
    `prepare:${progress.hasPrepareYoutube ? 'yes' : 'no'}`,
    `render:${progress.hasRender ? 'yes' : 'no'}`,
  ];

  if (progress.pendingReview > 0) {
    checklist.push(`review:${progress.pendingReview}`);
  }
  if (progress.pendingCardSpec > 0) {
    checklist.push(`card-spec:${progress.pendingCardSpec}`);
  }

  return checklist.join(', ');
}

export function buildSessionStartContext(root = process.cwd(), sessionId) {
  const config = getArsConfig(root);
  const messages = [];

  if (!config) {
    messages.push('ARS: .ars/config.json not found. Run /ars:onboard or npx ars init <series> to initialize this repo.');
    return messages;
  }

  const activeSeries = getActiveSeries(root);
  const { progress, workState } = getCurrentEpisodeSummary(root, sessionId);
  const youtubeEnabled = config?.publish?.youtube?.enabled === true;
  const ttsProvider = config?.tts?.provider ?? 'none';

  messages.push(
    `ARS: repo ready | activeSeries=${activeSeries ?? '(unset)'} | tts=${ttsProvider} | youtube=${youtubeEnabled ? 'on' : 'off'}`,
  );

    if (progress) {
      const restored = workState?.episodeId === progress.episodeId ? 'resume' : 'latest';
      messages.push(
        `ARS: ${restored} ${formatProgressLine(progress)} | next=${progress.nextAction}`,
      );
      messages.push(`ARS: checklist ${formatChecklistLine(progress)}`);
    }

  return messages;
}

export function extractEpisodeIdsFromText(text) {
  const normalized = normalizePromptText(text);
  return Array.from(
    new Set((normalized.match(EP_ID_PATTERN) ?? []).map((value) => value.toLowerCase())),
  );
}

export function buildPromptContext(root = process.cwd(), promptPayload, sessionId) {
  const activeSeries = getActiveSeries(root);
  if (!activeSeries) {
    return [];
  }

  const promptText = normalizePromptText(promptPayload);
  const mentioned = extractEpisodeIdsFromText(promptText);
  const { progress: currentProgress } = getCurrentEpisodeSummary(root, sessionId);

  const targetEpisodeIds = mentioned.length > 0
    ? mentioned
    : /(這集|這個\s*episode|this episode|current episode|continue)/i.test(promptText) && currentProgress
      ? [currentProgress.episodeId]
      : [];

  const lines = [];
  for (const episodeId of targetEpisodeIds.slice(0, 3)) {
    const progress = detectEpisodeProgress(root, activeSeries, episodeId);
    if (progress.lastModifiedAtMs === 0 && !progress.hasSource && !progress.hasPlan && progress.pendingReview === 0) {
      continue;
    }
    lines.push(`ARS stage hint: ${formatProgressLine(progress)} | next=${progress.nextAction}`);
    lines.push(`ARS checklist: ${formatChecklistLine(progress)}`);
  }

  return lines;
}

export function parseArsCommand(command, activeSeries) {
  const patterns = [
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+episode\s+create\s+([^\s]+)/i, stage: 'draft', action: 'episode-create' },
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+review\s+open\s+([^\s]+)/i, stage: 'review', action: 'review-open' },
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+audio\s+generate\s+([^\s]+)/i, stage: 'audio', action: 'audio-generate' },
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+prepare\s+youtube\s+([^\s]+)/i, stage: 'prepare-youtube', action: 'prepare-youtube' },
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+publish\s+package\s+([^\s]+)/i, stage: 'package', action: 'publish-package' },
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+publish\s+youtube\s+([^\s]+)/i, stage: 'publish-youtube', action: 'publish-youtube' },
    { regex: /(?:^|\s)(?:npx\s+)?ars\s+upload\s+youtube\s+([^\s]+)/i, stage: 'publish-youtube', action: 'upload-youtube' },
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern.regex);
    if (!match) {
      continue;
    }
    const target = parseTarget(match[1], activeSeries);
    if (!target) {
      return null;
    }
    return {
      ...target,
      stage: pattern.stage,
      lastAction: pattern.action,
      command,
    };
  }

  return null;
}

export function updateWorkStateFromCommand(root = process.cwd(), sessionId, command) {
  const activeSeries = getActiveSeries(root);
  if (!activeSeries) {
    return null;
  }

  const parsed = parseArsCommand(command, activeSeries);
  if (!parsed) {
    return null;
  }

  const progress = detectEpisodeProgress(root, parsed.seriesId, parsed.episodeId);
  return writeWorkState(root, sessionId, {
    seriesId: parsed.seriesId,
    episodeId: parsed.episodeId,
    stage: parsed.stage,
    derivedStage: progress.stage,
    lastAction: parsed.lastAction,
    pendingReview: progress.pendingReview,
    pendingCardSpec: progress.pendingCardSpec,
    audioCount: progress.audioCount,
    subtitleReady: progress.hasSubtitles,
    prepareYoutubeReady: progress.hasPrepareYoutube,
    renderReady: progress.hasRender,
  });
}

// ANSI helpers
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';

/**
 * Map a raw stage string to a pipeline step index (0-based).
 * Pipeline: plan(0) › review(1) › audio(2) › prepare(3) › publish(4)
 */
function stageToStep(stage) {
  if (!stage) return -1;
  if (stage === 'draft') return 0;
  if (stage === 'review') return 1;
  if (stage === 'audio') return 2;
  if (stage === 'prepare-youtube' || stage === 'package') return 3;
  if (stage === 'publish-youtube') return 4;
  return -1;
}

/**
 * Render the 5-step pipeline with ANSI colors:
 *   done  → green
 *   current → cyan bold with ▶ prefix
 *   todo  → dim
 */
function renderPipeline(currentStep) {
  const steps = ['plan', 'review', 'audio', 'prepare', 'publish'];
  return steps.map((label, i) => {
    if (i < currentStep) return `${GREEN}${label}${RESET}`;
    if (i === currentStep) return `${CYAN}${BOLD}▶${label}${RESET}`;
    return `${DIM}${label}${RESET}`;
  }).join(` ${DIM}›${RESET} `);
}

export function renderStatusLine(root = process.cwd(), sessionId, version = '') {
  const config = getArsConfig(root);
  if (!config) {
    return `${DIM}ARS${RESET} init needed`;
  }

  const { activeSeries, progress, workState } = getCurrentEpisodeSummary(root, sessionId);

  const versionTag = version ? `${DIM}ARS#${version}${RESET}` : `${DIM}ARS${RESET}`;

  if (!progress || !activeSeries) {
    const series = activeSeries ?? 'series:(unset)';
    return `${versionTag} ${series}`;
  }

  const rawStage = workState?.stage ?? progress.stage ?? '';
  const currentStep = stageToStep(rawStage);
  const pipeline = renderPipeline(currentStep >= 0 ? currentStep : 0);
  const epLabel = `${BOLD}${activeSeries}/${progress.episodeId}${RESET}`;

  return `${versionTag} ${epLabel}  ${pipeline}`;
}
