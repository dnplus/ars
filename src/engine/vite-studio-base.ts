/**
 * @file vite-studio-base.ts
 * @description Shared Vite config for ARS Studio.
 *              Runs from root dir; uses SERIES env to resolve theme path.
 *
 * Usage:
 *   import { createStudioConfig } from './src/engine/vite-studio-base';
 *   export default createStudioConfig({ port: 5174 });
 */
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { createRequire } from 'module';
import { getTTSProviderCapabilities } from '../adapters/tts/registry';
import { createReviewIntent } from '../review/review-intents';
import type { SpeechProviderId } from './shared/types';

export interface StudioConfigOptions {
  /** Dev server port (each project should use a unique port) */
  port: number;
}

export function createStudioConfig(options: StudioConfigOptions): UserConfig {
  // When launched via `npx ars review open`, ARS_REPO_ROOT points to the user's
  // content repo. Fall back to process.cwd() for local ARS development.
  const rootDir = process.env.ARS_REPO_ROOT ?? process.cwd();
  const fixAppliedEntries = new Map<string, FixAppliedEntry>();
  let latestFixApplied: FixAppliedEntry | null = null;

  // SERIES/EP 由 CLI review.ts 傳入，用於自動開啟 URL
  const series = process.env.SERIES || 'template';
  const targetEp = process.env.EP || '';
  const targetStep = process.env.STEP || '';
  const openParams = new URLSearchParams();
  if (series) openParams.set('series', series);
  if (targetEp) openParams.set('ep', targetEp);
  if (targetStep) openParams.set('step', targetStep);
  const openPath = targetEp ? `/?${openParams.toString()}` : true;

  // When launched via `npx ars review open`, ARS_PACKAGE_ROOT points to the ARS package.
  // Fall back to resolving from import.meta.url for local ARS development.
  const arsPackageRoot = process.env.ARS_PACKAGE_ROOT
    ?? path.resolve(new URL(import.meta.url).pathname, '..', '..', '..');
  const arsModulesDir = path.join(arsPackageRoot, 'node_modules');
  const require = createRequire(path.join(arsPackageRoot, 'package.json'));
  const tsxLoader = require.resolve('tsx');
  const arsCliEntrypoint = path.join(arsPackageRoot, 'cli', 'index.ts');
  let audioJobState: AudioJobState = { status: 'idle' };
  let audioJobProcess: ChildProcess | null = null;

  return defineConfig({
    root: path.resolve(rootDir, 'src'),
    base: '/',
    publicDir: path.resolve(rootDir, 'public'),
    define: {},
    plugins: [
      react(),
      {
        name: 'review-intent-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname !== '/__ars/review-intent') {
              next();
              return;
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
              return;
            }

            try {
              const body = await readJsonBody(req);
              const target = {
                series: asRequiredString(body.series, 'series'),
                epId: asRequiredString(body.epId, 'epId'),
                stepId: asRequiredString(body.stepId, 'stepId'),
              };
              const record = createReviewIntent({
                target,
                source: {
                  ui: asReviewUi(body.from ?? body.ui ?? 'studio'),
                  hash: asOptionalString(body.hash),
                },
                feedback: {
                  kind: asReviewKind(body.kind ?? 'other'),
                  message: asRequiredString(body.message, 'message'),
                  severity: asReviewSeverity(body.severity ?? 'medium'),
                },
                attachments: persistReviewAttachments(body, rootDir, target),
                rootDir,
              });

              res.statusCode = 201;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, intent: record.intent }));
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: message }));
            }
          });
        },
      },
      {
        name: 'review-session-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');

            if (url.pathname === '/__ars/review-session-end') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const reviewIntentsDir = path.join(rootDir, '.ars', 'review-intents');
                fs.mkdirSync(reviewIntentsDir, { recursive: true });
                const intentCount = fs.readdirSync(reviewIntentsDir)
                  .filter((fileName) => fileName.endsWith('.json'))
                  .length;
                const payload = {
                  timestamp: new Date().toISOString(),
                  intentCount,
                };

                fs.writeFileSync(
                  path.join(reviewIntentsDir, '_session-end.flag'),
                  `${JSON.stringify(payload, null, 2)}\n`,
                  'utf-8',
                );

                writeJson(res, 200, { ok: true, intentCount });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 500, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/review-intents') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const reviewDir = path.join(rootDir, '.ars', 'review-intents');
                if (!fs.existsSync(reviewDir)) {
                  writeJson(res, 200, { ok: true, intents: [] });
                  return;
                }

                const fileNames = fs.readdirSync(reviewDir)
                  .filter((fileName) => fileName.endsWith('.json'))
                  .sort((a, b) => b.localeCompare(a));

                const intents = fileNames.map((fileName) => {
                  const raw = fs.readFileSync(path.join(reviewDir, fileName), 'utf-8');
                  return JSON.parse(raw) as unknown;
                });

                writeJson(res, 200, { ok: true, intents });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 500, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/fix-applied') {
              if (req.method === 'POST') {
                try {
                  const body = await readJsonBody(req);
                  const stepIds = asStepIds(body.stepIds);
                  const timestamp = new Date().toISOString();
                  const entry = { timestamp, stepIds };

                  fixAppliedEntries.set(timestamp, entry);
                  latestFixApplied = entry;

                  writeJson(res, 200, { ok: true });
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  writeJson(res, 400, { ok: false, error: message });
                }
                return;
              }

              if (req.method === 'GET') {
                writeJson(res, 200, { ok: true, latest: latestFixApplied });
                return;
              }

              writeJson(res, 405, { ok: false, error: 'Method not allowed' });
              return;
            }

            if (url.pathname === '/__ars/audio-generate') {
              if (req.method === 'GET') {
                writeJson(res, 200, { ok: true, job: audioJobState });
                return;
              }

              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const body = await readJsonBody(req);
                const series = asRequiredString(body.series, 'series');
                const epId = asRequiredString(body.epId, 'epId');
                const target = `${series}/${epId}`;
                const capability = resolveAudioCapability(rootDir, series);

                if (audioJobState.status === 'running') {
                  writeJson(res, 409, { ok: false, error: 'Audio generation already running.', job: audioJobState });
                  return;
                }

                if (!capability.enabled) {
                  writeJson(res, 400, {
                    ok: false,
                    error: capability.reason ?? 'Audio generation is not available.',
                  });
                  return;
                }

                audioJobState = {
                  status: 'running',
                  series,
                  epId,
                  startedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  outputTail: [],
                };

                const child = spawn(
                  process.execPath,
                  ['--import', tsxLoader, arsCliEntrypoint, 'audio', 'generate', target],
                  {
                    cwd: rootDir,
                    env: process.env,
                    stdio: ['ignore', 'pipe', 'pipe'],
                  },
                );

                audioJobProcess = child;
                const appendOutput = (chunk: string) => {
                  const lines = chunk
                    .split(/\r?\n/)
                    .map((line) => line.trimEnd())
                    .filter((line) => line.trim().length > 0);

                  if (lines.length === 0) {
                    return;
                  }

                  const nextTail = [...(audioJobState.outputTail ?? []), ...lines].slice(-12);
                  audioJobState = {
                    ...audioJobState,
                    updatedAt: new Date().toISOString(),
                    outputTail: nextTail,
                  };
                };

                child.stdout.on('data', (chunk) => appendOutput(String(chunk)));
                child.stderr.on('data', (chunk) => appendOutput(String(chunk)));
                child.on('close', (code) => {
                  audioJobState = {
                    ...audioJobState,
                    status: code === 0 ? 'succeeded' : 'failed',
                    exitCode: code ?? null,
                    finishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  audioJobProcess = null;
                });
                child.on('error', (error) => {
                  audioJobState = {
                    ...audioJobState,
                    status: 'failed',
                    finishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    outputTail: [...(audioJobState.outputTail ?? []), error.message].slice(-12),
                  };
                  audioJobProcess = null;
                });

                writeJson(res, 202, { ok: true, job: audioJobState });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/audio-capability') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const requestedSeries = url.searchParams.get('series')?.trim();
                const capability = resolveAudioCapability(rootDir, requestedSeries || undefined);
                writeJson(res, 200, { ok: true, capability });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 500, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/episode-source-map') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const requestedSeries = asRequiredString(url.searchParams.get('series'), 'series');
                const requestedEpId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const sourceMap = getEpisodeSourceMap(rootDir, requestedSeries, requestedEpId);
                writeJson(res, 200, { ok: true, sourceMap });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            next();
          });
        },
      },
      // Custom plugin to serve slides.html as index
      {
        name: 'studio-html',
        configureServer(server: any) {
          server.middlewares.use((req: any, _res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname === '/' || url.pathname === '/index.html') {
              req.url = '/studio.html' + url.search;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: [
        // When running in external user repo, redirect all node_modules lookups
        // to ARS package's node_modules so vite can find react, remotion, etc.
        ...(process.env.ARS_PACKAGE_ROOT ? [
          { find: /^react\/(.*)/, replacement: path.join(arsModulesDir, 'react', '$1') },
          { find: 'react', replacement: path.join(arsModulesDir, 'react') },
          { find: 'react-dom/client', replacement: path.join(arsModulesDir, 'react-dom', 'client') },
          { find: 'react-dom', replacement: path.join(arsModulesDir, 'react-dom') },
          { find: 'remotion', replacement: path.join(arsModulesDir, 'remotion') },
          { find: '@remotion/player', replacement: path.join(arsModulesDir, '@remotion', 'player') },
          { find: 'mermaid', replacement: path.join(arsModulesDir, 'mermaid') },
          { find: 'prism-react-renderer', replacement: path.join(arsModulesDir, 'prism-react-renderer') },
          { find: 'react-markdown', replacement: path.join(arsModulesDir, 'react-markdown') },
          { find: 'remark-gfm', replacement: path.join(arsModulesDir, 'remark-gfm') },
          { find: 'remark-breaks', replacement: path.join(arsModulesDir, 'remark-breaks') },
          { find: 'qrcode.react', replacement: path.join(arsModulesDir, 'qrcode.react') },
        ] : []),
        // Mock only packages that have no web-compatible real implementation
        { find: '@remotion/google-fonts/NotoSansTC', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-google-fonts.ts') },
        { find: '@remotion/media', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-media.ts') },
        { find: '@remotion/media-utils', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-media-utils.ts') },
        { find: '@remotion/three', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-three.tsx') },
        { find: '@shopify/react-native-skia', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/react-native-skia.tsx') },
        { find: '@shopify/react-native-skia/src/web', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/react-native-skia.tsx') },
      ],
    },
    build: {
      outDir: '../dist/studio',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/studio.html'),
      },
    },
    server: {
      port: options.port,
      open: openPath,
      fs: {
        // Allow serving files from ARS package when running in external user repo
        allow: [rootDir, arsModulesDir],
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'mermaid', 'prism-react-renderer', 'react-markdown', 'remark-gfm', '@remotion/player'],
      exclude: ['@remotion/three'],
    },
  }) as UserConfig;
}

type FixAppliedEntry = {
  timestamp: string;
  stepIds: string[];
};

type AudioJobState = {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  series?: string;
  epId?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  exitCode?: number | null;
  outputTail?: string[];
};

type AudioCapability = {
  visible: boolean;
  enabled: boolean;
  reason?: string;
};

async function readJsonBody(req: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw) {
    throw new Error('Missing JSON body.');
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object.');
  }

  return parsed as Record<string, unknown>;
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid "${field}" value.`);
  }

  return value.trim();
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

function persistReviewAttachments(
  body: Record<string, unknown>,
  rootDir: string,
  target: { series: string; epId: string; stepId: string },
) {
  const attachmentsValue = body.attachments;
  const screenshotPath =
    asOptionalString(body.screenshotPath) ||
    (attachmentsValue && typeof attachmentsValue === 'object' && !Array.isArray(attachmentsValue)
      ? asOptionalString((attachmentsValue as Record<string, unknown>).screenshotPath)
      : undefined);
  const screenshotDataUrl =
    attachmentsValue && typeof attachmentsValue === 'object' && !Array.isArray(attachmentsValue)
      ? asOptionalString((attachmentsValue as Record<string, unknown>).screenshotDataUrl)
      : undefined;

  if (!screenshotPath && !screenshotDataUrl) {
    return undefined;
  }

  if (screenshotDataUrl) {
    return {
      screenshotPath: writeReviewAttachmentFile(rootDir, target, screenshotDataUrl),
    };
  }

  return {
    screenshotPath,
  };
}

function writeReviewAttachmentFile(
  rootDir: string,
  target: { series: string; epId: string; stepId: string },
  screenshotDataUrl: string,
): string {
  const match = screenshotDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid review attachment image data.');
  }

  const [, mimeType, base64Payload] = match;
  const extension = imageMimeToExtension(mimeType);
  const attachmentDir = path.join(
    rootDir,
    '.ars',
    'review-assets',
    sanitizePathToken(target.series),
    sanitizePathToken(target.epId),
  );
  fs.mkdirSync(attachmentDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `${timestamp}-${sanitizePathToken(target.stepId)}.${extension}`;
  const filePath = path.join(attachmentDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64Payload, 'base64'));
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function imageMimeToExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      throw new Error(`Unsupported review attachment mime type: ${mimeType}`);
  }
}

function sanitizePathToken(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized.replace(/^-|-$/g, '') || 'attachment';
}

function asReviewUi(value: unknown): 'studio' {
  if (value === 'studio' || value === 'slides') {
    return 'studio';
  }

  throw new Error('Invalid review source ui.');
}

function asReviewKind(value: unknown): 'visual' | 'content' | 'timing' | 'other' {
  if (value === 'visual' || value === 'content' || value === 'timing' || value === 'other') {
    return value;
  }

  throw new Error('Invalid review feedback kind.');
}

function asReviewSeverity(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  throw new Error('Invalid review feedback severity.');
}

function asStepIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Invalid "stepIds" value.');
  }

  const stepIds = value.map((entry) => asRequiredString(entry, 'stepIds[]'));
  return Array.from(new Set(stepIds));
}

function resolveAudioCapability(rootDir: string, series?: string): AudioCapability {
  const config = readLocalArsConfig(rootDir);
  if (!config) {
    return {
      visible: false,
      enabled: false,
      reason: '尚未初始化 ARS 設定；先執行 ars init <series>。',
    };
  }

  const seriesId = series || config.project.activeSeries;
  if (!seriesId) {
    return {
      visible: false,
      enabled: false,
      reason: '尚未設定 active series。',
    };
  }

  const speechConfig = readSeriesSpeechSummary(rootDir, seriesId);
  if (!speechConfig.provider) {
    return {
      visible: false,
      enabled: false,
      reason: 'series-config.ts 缺少 speech.provider。',
    };
  }

  if (speechConfig.provider === 'elevenlabs') {
    return {
      visible: true,
      enabled: false,
      reason: 'ElevenLabs adapter 尚未實作。',
    };
  }

  const hasApiKey = !!process.env.MINIMAX_API_KEY;
  const hasGroupId = !!process.env.MINIMAX_GROUP_ID;
  if (!hasApiKey || !hasGroupId) {
    const missing = [
      !hasApiKey && 'MINIMAX_API_KEY',
      !hasGroupId && 'MINIMAX_GROUP_ID',
    ].filter(Boolean).join(', ');
    return {
      visible: true,
      enabled: false,
      reason: `缺少 ${missing}。`,
    };
  }

  const hasEnvVoiceId = !!process.env.MINIMAX_VOICE_ID || !!process.env.MINIMAX_CLONE_ID;
  if (!hasEnvVoiceId && !speechConfig.hasDefaultVoice) {
    return {
      visible: true,
      enabled: false,
      reason: '缺少 voice；請設定 speech.defaults.voice 或 MINIMAX_VOICE_ID。',
    };
  }

  const capabilities = getTTSProviderCapabilities(speechConfig.provider);
  if (speechConfig.reviewRequiresNativeTiming && !capabilities.nativeTiming) {
    return {
      visible: true,
      enabled: false,
      reason: `${speechConfig.provider} 不支援 review 需要的 native timing。`,
    };
  }

  return { visible: true, enabled: true };
}

function readSeriesSpeechSummary(rootDir: string, series: string): {
  provider: SpeechProviderId | null;
  hasDefaultVoice: boolean;
  reviewRequiresNativeTiming: boolean;
} {
  const seriesConfigPath = path.join(rootDir, 'src', 'episodes', series, 'series-config.ts');
  if (!fs.existsSync(seriesConfigPath)) {
    return {
      provider: null,
      hasDefaultVoice: false,
      reviewRequiresNativeTiming: true,
    };
  }

  try {
    const content = fs.readFileSync(seriesConfigPath, 'utf-8');
    const providerMatch = content.match(/provider:\s*['"](minimax|elevenlabs)['"]/);
    const reviewMatch = content.match(/reviewRequiresNativeTiming:\s*(true|false)/);
    return {
      provider: (providerMatch?.[1] as SpeechProviderId | undefined) ?? null,
      hasDefaultVoice: /voice:\s*['"][^'"]+['"]/.test(content),
      reviewRequiresNativeTiming: reviewMatch?.[1] !== 'false',
    };
  } catch {
    return {
      provider: null,
      hasDefaultVoice: false,
      reviewRequiresNativeTiming: true,
    };
  }
}

function readLocalArsConfig(rootDir: string): LocalArsConfig | null {
  const configPath = path.join(rootDir, '.ars', 'config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const record = raw as Record<string, unknown>;
    const project = (
      record.project && typeof record.project === 'object' && !Array.isArray(record.project)
        ? record.project
        : {}
    ) as Record<string, unknown>;

    return {
      project: {
        activeSeries: typeof project.activeSeries === 'string' ? project.activeSeries : undefined,
      },
    };
  } catch {
    return null;
  }
}

function writeJson(
  res: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getEpisodeSourceMap(rootDir: string, series: string, epId: string): {
  filePath: string;
  stepLines: Record<string, number>;
} {
  const filePath = path.join(rootDir, 'src', 'episodes', series, `${epId}.ts`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Episode not found: ${filePath}`);
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  const stepsRange = findStepsArrayRange(source);
  if (!stepsRange) {
    return { filePath, stepLines: {} };
  }

  const stepLines: Record<string, number> = {};
  let cursor = stepsRange.start + 1;

  while (cursor < stepsRange.end) {
    cursor = skipTrivia(source, cursor, stepsRange.end);
    if (cursor >= stepsRange.end) {
      break;
    }

    if (source[cursor] !== '{') {
      cursor += 1;
      continue;
    }

    const objectEnd = findMatching(source, cursor, '{', '}', stepsRange.end + 1);
    if (objectEnd === -1) {
      break;
    }

    const objectText = source.slice(cursor, objectEnd + 1);
    const idProperty = findTopLevelProperty(objectText, 'id');
    const idValue = idProperty
      ? objectText.slice(idProperty.valueStart, idProperty.valueEnd).trim()
      : null;
    const stepId = idValue?.match(/^['"](.+)['"]$/)?.[1];

    if (stepId) {
      stepLines[stepId] = getLineNumber(source, cursor);
    }

    cursor = objectEnd + 1;
  }

  return { filePath, stepLines };
}

function findStepsArrayRange(source: string): { start: number; end: number } | null {
  const stepsMatch = /steps\s*:\s*\[/.exec(source);
  if (!stepsMatch) {
    return null;
  }

  const openIndex = source.indexOf('[', stepsMatch.index);
  if (openIndex === -1) {
    return null;
  }

  const closeIndex = findMatching(source, openIndex, '[', ']');
  if (closeIndex === -1) {
    return null;
  }

  return { start: openIndex, end: closeIndex };
}

function findTopLevelProperty(
  objectText: string,
  field: string,
): { valueStart: number; valueEnd: number } | null {
  let cursor = 1;
  const limit = objectText.length - 1;

  while (cursor < limit) {
    cursor = skipTrivia(objectText, cursor, limit);
    if (cursor >= limit) {
      break;
    }

    if (objectText[cursor] === ',') {
      cursor += 1;
      continue;
    }

    const keyInfo = readPropertyName(objectText, cursor, limit);
    if (!keyInfo) {
      cursor += 1;
      continue;
    }

    const colonIndex = skipTrivia(objectText, keyInfo.nextIndex, limit);
    if (objectText[colonIndex] !== ':') {
      cursor = keyInfo.nextIndex;
      continue;
    }

    const valueStart = skipTrivia(objectText, colonIndex + 1, limit);
    let scan = valueStart;
    let curlyDepth = 0;
    let squareDepth = 0;
    let parenDepth = 0;

    while (scan < limit) {
      const char = objectText[scan];
      const next = objectText[scan + 1];

      if (char === '"' || char === '\'' || char === '`') {
        scan = readQuotedString(objectText, scan, char, limit);
        continue;
      }

      if (char === '/' && next === '/') {
        scan += 2;
        while (scan < limit && objectText[scan] !== '\n') scan += 1;
        continue;
      }

      if (char === '/' && next === '*') {
        scan += 2;
        while (scan < limit && !(objectText[scan] === '*' && objectText[scan + 1] === '/')) scan += 1;
        scan += 2;
        continue;
      }

      if (char === '{') curlyDepth += 1;
      else if (char === '}') {
        if (curlyDepth === 0 && squareDepth === 0 && parenDepth === 0) break;
        curlyDepth -= 1;
      } else if (char === '[') squareDepth += 1;
      else if (char === ']') squareDepth -= 1;
      else if (char === '(') parenDepth += 1;
      else if (char === ')') parenDepth -= 1;
      else if (char === ',' && curlyDepth === 0 && squareDepth === 0 && parenDepth === 0) break;

      scan += 1;
    }

    if (keyInfo.name === field) {
      let valueEnd = scan;
      while (valueEnd > valueStart && /\s/.test(objectText[valueEnd - 1])) {
        valueEnd -= 1;
      }
      return { valueStart, valueEnd };
    }

    cursor = scan + 1;
  }

  return null;
}

function readPropertyName(
  source: string,
  index: number,
  limit: number,
): { name: string; nextIndex: number } | null {
  const start = skipTrivia(source, index, limit);
  const char = source[start];

  if (char === '\'' || char === '"') {
    let cursor = start + 1;
    let value = '';
    while (cursor < limit) {
      const current = source[cursor];
      if (current === '\\') {
        value += source.slice(cursor, cursor + 2);
        cursor += 2;
        continue;
      }

      if (current === char) {
        return { name: value, nextIndex: cursor + 1 };
      }

      value += current;
      cursor += 1;
    }

    return null;
  }

  const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(start));
  if (!identifier) {
    return null;
  }

  return {
    name: identifier[0],
    nextIndex: start + identifier[0].length,
  };
}

function skipTrivia(source: string, index: number, limit: number): number {
  let cursor = index;
  while (cursor < limit) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      cursor += 2;
      while (cursor < limit && source[cursor] !== '\n') cursor += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      cursor += 2;
      while (cursor < limit && !(source[cursor] === '*' && source[cursor + 1] === '/')) cursor += 1;
      cursor += 2;
      continue;
    }

    break;
  }

  return cursor;
}

function readQuotedString(source: string, index: number, quote: string, limit: number): number {
  let cursor = index + 1;
  while (cursor < limit) {
    const char = source[cursor];
    if (char === '\\') {
      cursor += 2;
      continue;
    }

    if (quote === '`' && char === '$' && source[cursor + 1] === '{') {
      cursor = findMatching(source, cursor + 1, '{', '}', limit) + 1;
      continue;
    }

    if (char === quote) {
      return cursor + 1;
    }

    cursor += 1;
  }

  return limit;
}

function findMatching(
  source: string,
  start: number,
  openChar: string,
  closeChar: string,
  limit = source.length,
): number {
  let depth = 0;
  let cursor = start;

  while (cursor < limit) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (char === '"' || char === '\'' || char === '`') {
      cursor = readQuotedString(source, cursor, char, limit);
      continue;
    }

    if (char === '/' && next === '/') {
      cursor += 2;
      while (cursor < limit && source[cursor] !== '\n') cursor += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      cursor += 2;
      while (cursor < limit && !(source[cursor] === '*' && source[cursor + 1] === '/')) cursor += 1;
      cursor += 2;
      continue;
    }

    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }

  return -1;
}

function getLineNumber(source: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '\n') {
      line += 1;
    }
  }
  return line;
}

type LocalArsConfig = {
  project: {
    activeSeries?: string;
  };
};
