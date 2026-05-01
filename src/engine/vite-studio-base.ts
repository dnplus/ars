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
import * as ts from 'typescript';
import { getTTSProviderCapabilities } from '../adapters/tts/registry';
import { createStudioIntent, getStudioIntentsDir } from '../studio/studio-intents';
import { migrateReviewIntents } from '../studio/migrate-review-intents';
import {
  generatePreparedYoutubeCandidates,
  getPrepareArtifactPath,
  getPrepareMarkdownPath,
  readPrepareArtifact,
  selectPreparedYoutubeCandidate,
  writePrepareArtifact,
  type YoutubePrepareArtifact,
} from '../studio/prepare-youtube-artifact';
import type { StudioIntentAnchorType, StudioIntentTarget } from '../types/studio-intent';
import { extractSections } from './shared/markdown-anchor';
import type { EpisodeMetadata, SpeechProviderId } from './shared/types';

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

  try {
    const result = migrateReviewIntents(rootDir);
    if (!result.skipped && (result.intentsMigrated > 0 || result.assetsMigrated > 0)) {
      console.log(
        `[ars] migrated ${result.intentsMigrated} review-intent(s) and ${result.assetsMigrated} asset(s) to .ars/studio-intents/ and .ars/studio-assets/`,
      );
    }
  } catch (error) {
    console.warn('[ars] review-intent migration failed:', error instanceof Error ? error.message : error);
  }

  // SERIES/EP 由 CLI review.ts 傳入，用於自動開啟 URL
  const series = process.env.SERIES || 'template';
  const targetEp = process.env.EP || '';
  const targetStep = process.env.STEP || '';
  const targetPhase = process.env.PHASE || '';
  const openParams = new URLSearchParams();
  if (series) openParams.set('series', series);
  if (targetEp) openParams.set('ep', targetEp);
  if (targetPhase) openParams.set('phase', targetPhase);
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
  // Prepare + Publish share the same shape (spawn → tail output → terminal
  // status). We reuse AudioJobState as the job schema but keep one slot per
  // action to avoid cross-contamination.
  let prepareJobState: AudioJobState = { status: 'idle' };
  let prepareJobProcess: ChildProcess | null = null;
  let publishJobState: AudioJobState = { status: 'idle' };
  let publishJobProcess: ChildProcess | null = null;

  return defineConfig({
    root: path.resolve(rootDir, 'src'),
    base: '/',
    publicDir: path.resolve(rootDir, 'public'),
    define: {},
    plugins: [
      react(),
      {
        name: 'studio-intent-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');
            const isLegacy = url.pathname === '/__ars/review-intent';
            if (url.pathname !== '/__ars/studio-intent' && !isLegacy) {
              next();
              return;
            }
            if (isLegacy) {
              warnLegacy('POST /__ars/review-intent', 'POST /__ars/studio-intent');
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
              return;
            }

            try {
              const body = await readJsonBody(req);
              const series = asRequiredString(body.series, 'series');
              const epId = asRequiredString(body.epId, 'epId');
              const stepId = asOptionalString(body.stepId);
              const anchorTypeRaw = asOptionalString(body.anchorType);
              const anchorIdRaw = asOptionalString(body.anchorId);
              const anchorType: StudioIntentAnchorType = anchorTypeRaw
                ? asAnchorType(anchorTypeRaw)
                : stepId ? 'step' : 'episode';
              const anchorId = anchorIdRaw ?? stepId ?? 'episode';

              const target: StudioIntentTarget = {
                series,
                epId,
                anchorType,
                anchorId,
                stepId,
                anchorMeta: parseAnchorMeta(body.anchorMeta),
              };

              const record = createStudioIntent({
                target,
                source: {
                  ui: asStudioUi(body.from ?? body.ui ?? 'studio'),
                  hash: asOptionalString(body.hash),
                },
                feedback: {
                  kind: asStudioKind(body.kind ?? 'other'),
                  message: asRequiredString(body.message, 'message'),
                  severity: asStudioSeverity(body.severity ?? 'medium'),
                },
                attachments: persistStudioAttachments(body, rootDir, { series, epId, anchorId }),
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
        name: 'studio-session-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');

            const isSessionEnd = url.pathname === '/__ars/studio-session-end' || url.pathname === '/__ars/review-session-end';
            if (isSessionEnd) {
              if (url.pathname === '/__ars/review-session-end') {
                warnLegacy('POST /__ars/review-session-end', 'POST /__ars/studio-session-end');
              }
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const studioIntentsDir = getStudioIntentsDir(rootDir);
                fs.mkdirSync(studioIntentsDir, { recursive: true });
                const intentCount = fs.readdirSync(studioIntentsDir)
                  .filter((fileName) => fileName.endsWith('.json'))
                  .length;
                const payload = {
                  timestamp: new Date().toISOString(),
                  intentCount,
                };

                fs.writeFileSync(
                  path.join(studioIntentsDir, '_session-end.flag'),
                  `${JSON.stringify(payload, null, 2)}\n`,
                  'utf-8',
                );

                const stage = readWorkstateStage(rootDir);
                if (isOnboardStage(stage)) {
                  updateOnboardSession(rootDir, {
                    event: 'close',
                    stage,
                    series,
                    epId: targetEp,
                  });
                }

                writeJson(res, 200, { ok: true, intentCount });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 500, { ok: false, error: message });
              }
              return;
            }

            const isList = url.pathname === '/__ars/studio-intents' || url.pathname === '/__ars/review-intents';
            if (isList) {
              if (url.pathname === '/__ars/review-intents') {
                warnLegacy('GET /__ars/review-intents', 'GET /__ars/studio-intents');
              }
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const studioDir = getStudioIntentsDir(rootDir);
                if (!fs.existsSync(studioDir)) {
                  writeJson(res, 200, { ok: true, intents: [] });
                  return;
                }

                const fileNames = fs.readdirSync(studioDir)
                  .filter((fileName) => fileName.endsWith('.json'))
                  .sort((a, b) => b.localeCompare(a));

                const intents = fileNames.map((fileName) => {
                  const raw = fs.readFileSync(path.join(studioDir, fileName), 'utf-8');
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

                // Optional CLI knobs from the modal. Keep backward compatible —
                // omit → same behavior as before (all steps, subtitle on).
                const noSubtitle = body.noSubtitle === true;
                const stepsRaw = Array.isArray(body.steps) ? body.steps : [];
                const steps = stepsRaw
                  .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
                  .map((s) => s.trim());
                const cliArgs: string[] = [
                  '--import', tsxLoader, arsCliEntrypoint,
                  'audio', 'generate', target,
                ];
                if (noSubtitle) cliArgs.push('--no-subtitle');
                if (steps.length > 0) cliArgs.push('--steps', steps.join(','));

                audioJobState = {
                  status: 'running',
                  series,
                  epId,
                  startedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  outputTail: [],
                };

                const child = spawn(process.execPath, cliArgs, {
                  cwd: rootDir,
                  env: process.env,
                  stdio: ['ignore', 'pipe', 'pipe'],
                });

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

            if (url.pathname === '/__ars/publish-capability') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const capability = resolvePublishCapability(rootDir);
                writeJson(res, 200, { ok: true, capability });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 500, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/onboard-status') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const requestedSeries = asRequiredString(url.searchParams.get('series'), 'series');
                const requestedEpId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const status = resolveOnboardStatus(rootDir, requestedSeries, requestedEpId);
                writeJson(res, 200, { ok: true, status });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/onboard-session') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const body = await readJsonBody(req);
                const event = asOptionalString(body.event);
                if (event !== 'open' && event !== 'heartbeat' && event !== 'close') {
                  throw new Error('event must be one of: open, heartbeat, close');
                }

                const seriesIn = asOptionalString(body.series);
                const epIdIn = asOptionalString(body.epId);
                const stage = readWorkstateStage(rootDir);
                const session = updateOnboardSession(rootDir, {
                  event,
                  stage,
                  series: seriesIn,
                  epId: epIdIn,
                });
                writeJson(res, 200, { ok: true, session });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            // Config preview for the Audio action. Lightweight by design:
            // returns CLI command + resolved provider/voice + capability state.
            // Step count / char totals are expected to come from the client's
            // already-loaded episode; we don't re-parse the .ts file here.
            if (url.pathname === '/__ars/audio-plan') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const series = asRequiredString(
                  url.searchParams.get('series'),
                  'series',
                );
                const epId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const capability = resolveAudioCapability(rootDir, series);
                const speechSummary = readSeriesSpeechSummary(rootDir, series);
                const outputDir = path.posix.join(
                  'public',
                  'episodes',
                  series,
                  epId,
                  'audio',
                );
                const subtitlesPath = path.posix.join(
                  'src',
                  'episodes',
                  series,
                  `${epId}.subtitles.ts`,
                );
                writeJson(res, 200, {
                  ok: true,
                  plan: {
                    cli: `npx ars audio generate ${series}/${epId}`,
                    series,
                    epId,
                    provider: speechSummary.provider,
                    hasDefaultVoice: speechSummary.hasDefaultVoice,
                    reviewRequiresNativeTiming:
                      speechSummary.reviewRequiresNativeTiming,
                    capability,
                    output: {
                      audioDir: outputDir,
                      subtitlesFile: subtitlesPath,
                    },
                    runningJob: audioJobState.status === 'running' ? audioJobState : null,
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            // -------- Prepare (youtube context preparation) --------
            if (url.pathname === '/__ars/prepare-plan') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const series = asRequiredString(url.searchParams.get('series'), 'series');
                const epId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const preparedArtifact = readPrepareArtifact(rootDir, series, epId);
                const episodeMetadata = await tryLoadEpisodeMetadata(rootDir, series, epId);
                const preparedArtifactPath = path.relative(
                  rootDir,
                  getPrepareArtifactPath(rootDir, series, epId),
                ).split(path.sep).join('/');
                const markdownPath = path.relative(
                  rootDir,
                  getPrepareMarkdownPath(rootDir, series, epId),
                ).split(path.sep).join('/');
                const pendingPrepareIntents = getPendingPrepareIntents(rootDir, series, epId, {
                  preparedArtifact,
                  episodeMetadata,
                });
                writeJson(res, 200, {
                  ok: true,
                  plan: {
                    cli: `npx ars prepare youtube ${series}/${epId}`,
                    series,
                    epId,
                    preparedExists: preparedArtifact !== null,
                    preparedStatus: preparedArtifact?.status ?? null,
                    output: {
                      artifact: preparedArtifactPath,
                      markdown: markdownPath,
                    },
                    notes:
                      'prepare 先產 context artifact；candidate 生成與挑選由 studio picker 完成。',
                    pendingPrepareIntents: pendingPrepareIntents.length,
                    runningJob: prepareJobState.status === 'running' ? prepareJobState : null,
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/prepare-artifact') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const series = asRequiredString(url.searchParams.get('series'), 'series');
                const epId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const artifact = readPrepareArtifact(rootDir, series, epId);
                const episodeMetadata = await tryLoadEpisodeMetadata(rootDir, series, epId);
                const pendingPrepareIntents = getPendingPrepareIntents(rootDir, series, epId, {
                  preparedArtifact: artifact,
                  episodeMetadata,
                });
                writeJson(res, 200, {
                  ok: true,
                  artifact,
                  pendingPrepareIntents,
                  paths: {
                    artifact: path.relative(rootDir, getPrepareArtifactPath(rootDir, series, epId)).split(path.sep).join('/'),
                    markdown: path.relative(rootDir, getPrepareMarkdownPath(rootDir, series, epId)).split(path.sep).join('/'),
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/prepare-generate') {
              if (req.method === 'GET') {
                writeJson(res, 200, { ok: true, job: prepareJobState });
                return;
              }
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const body = await readJsonBody(req);
                const series = asRequiredString(body.series, 'series');
                const epId = asRequiredString(body.epId, 'epId');
                const dryRun = body.dryRun === true;
                const target = `${series}/${epId}`;
                if (prepareJobState.status === 'running') {
                  writeJson(res, 409, { ok: false, error: 'Prepare already running.', job: prepareJobState });
                  return;
                }
                const cliArgs: string[] = [
                  '--import', tsxLoader, arsCliEntrypoint,
                  'prepare', 'youtube', target,
                ];
                if (dryRun) cliArgs.push('--dry-run');
                prepareJobState = {
                  status: 'running',
                  series, epId,
                  startedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  outputTail: [],
                };
                const child = spawn(process.execPath, cliArgs, {
                  cwd: rootDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
                });
                prepareJobProcess = child;
                const appendOutput = (chunk: string) => {
                  const lines = chunk.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
                  if (!lines.length) return;
                  prepareJobState = {
                    ...prepareJobState,
                    updatedAt: new Date().toISOString(),
                    outputTail: [...(prepareJobState.outputTail ?? []), ...lines].slice(-20),
                  };
                };
                child.stdout.on('data', (chunk) => appendOutput(String(chunk)));
                child.stderr.on('data', (chunk) => appendOutput(String(chunk)));
                child.on('close', (code) => {
                  prepareJobState = {
                    ...prepareJobState,
                    status: code === 0 ? 'succeeded' : 'failed',
                    exitCode: code ?? null,
                    finishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  prepareJobProcess = null;
                });
                child.on('error', (error) => {
                  prepareJobState = {
                    ...prepareJobState,
                    status: 'failed',
                    finishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    outputTail: [...(prepareJobState.outputTail ?? []), error.message].slice(-20),
                  };
                  prepareJobProcess = null;
                });
                writeJson(res, 202, { ok: true, job: prepareJobState });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/prepare-candidates') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const body = await readJsonBody(req);
                const series = asRequiredString(body.series, 'series');
                const epId = asRequiredString(body.epId, 'epId');
                const artifact = readPrepareArtifact(rootDir, series, epId);
                if (!artifact) {
                  writeJson(res, 404, { ok: false, error: 'Prepare artifact not found. Run prepare first.' });
                  return;
                }
                const nextArtifact: YoutubePrepareArtifact = {
                  ...artifact,
                  status: 'pending-review',
                  youtube: {
                    ...artifact.youtube,
                    selected: null,
                    title: null,
                    description: null,
                    tags: [],
                    candidates: generatePreparedYoutubeCandidates(artifact),
                  },
                };
                writePrepareArtifact(rootDir, nextArtifact);
                writeJson(res, 200, { ok: true, artifact: nextArtifact });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/prepare-select') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const body = await readJsonBody(req);
                const series = asRequiredString(body.series, 'series');
                const epId = asRequiredString(body.epId, 'epId');
                const candidateId = asRequiredString(body.candidateId, 'candidateId');
                const artifact = readPrepareArtifact(rootDir, series, epId);
                if (!artifact) {
                  writeJson(res, 404, { ok: false, error: 'Prepare artifact not found. Run prepare first.' });
                  return;
                }
                const nextArtifact = selectPreparedYoutubeCandidate(artifact, candidateId);
                writePrepareArtifact(rootDir, nextArtifact);
                writeJson(res, 200, { ok: true, artifact: nextArtifact });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            // -------- Publish (irreversible; requires explicit confirm on client) --------
            if (url.pathname === '/__ars/publish-plan') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const series = asRequiredString(url.searchParams.get('series'), 'series');
                const epId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const preparedArtifact = readPrepareArtifact(rootDir, series, epId);
                const episodeMetadata = await tryLoadEpisodeMetadata(rootDir, series, epId);
                const pendingPrepareIntents = getPendingPrepareIntents(rootDir, series, epId, {
                  preparedArtifact,
                  episodeMetadata,
                });
                const preparedArtifactPath = path.relative(
                  rootDir,
                  getPrepareArtifactPath(rootDir, series, epId),
                ).split(path.sep).join('/');
                writeJson(res, 200, {
                  ok: true,
                  plan: {
                    cli: `npx ars publish youtube ${series}/${epId}`,
                    series,
                    epId,
                    requiresPrepared: true,
                    preparedExists: preparedArtifact !== null,
                    preparedReady: preparedArtifact?.status === 'ready',
                    metadataApplied: !!episodeMetadata?.youtube,
                    pendingPrepareIntents: pendingPrepareIntents.length,
                    pendingPrepareIntentIds: pendingPrepareIntents
                      .map((intent) => intent.id)
                      .filter((id): id is string => typeof id === 'string'),
                    preparedArtifact: preparedArtifactPath,
                    privacyOptions: ['private', 'unlisted', 'public'] as const,
                    defaultPrivacy: 'private',
                    irreversible: true,
                    runningJob: publishJobState.status === 'running' ? publishJobState : null,
                    publishPreview: resolvePublishPreview(preparedArtifact, episodeMetadata?.youtube ?? null),
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/publish-generate') {
              if (req.method === 'GET') {
                writeJson(res, 200, { ok: true, job: publishJobState });
                return;
              }
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }
              try {
                const capability = resolvePublishCapability(rootDir);
                if (!capability.visible) {
                  writeJson(res, 409, { ok: false, error: capability.reason ?? 'YouTube publish is disabled.' });
                  return;
                }
                const body = await readJsonBody(req);
                const series = asRequiredString(body.series, 'series');
                const epId = asRequiredString(body.epId, 'epId');
                const mode = typeof body.mode === 'string' ? body.mode : 'youtube';
                const privacy = typeof body.privacy === 'string' ? body.privacy : 'private';
                const dryRun = body.dryRun === true;
                const force = body.force === true;
                const skippedIntentIds = parseStringArray(body.skippedIntentIds);
                const target = `${series}/${epId}`;
                const preparedArtifact = readPrepareArtifact(rootDir, series, epId);
                const episodeMetadata = await tryLoadEpisodeMetadata(rootDir, series, epId);
                const pendingPrepareIntents = getPendingPrepareIntents(rootDir, series, epId, {
                  preparedArtifact,
                  episodeMetadata,
                })
                  .filter((intent) => typeof intent.id !== 'string' || !skippedIntentIds.has(intent.id));
                if (publishJobState.status === 'running') {
                  writeJson(res, 409, { ok: false, error: 'Publish already running.', job: publishJobState });
                  return;
                }
                if (!preparedArtifact || preparedArtifact.status !== 'ready') {
                  writeJson(res, 409, { ok: false, error: 'Prepare is not ready yet. Select a candidate first.' });
                  return;
                }
                if (!episodeMetadata?.youtube) {
                  writeJson(res, 409, { ok: false, error: 'Prepare is ready but not applied to episode metadata.youtube yet.' });
                  return;
                }
                if (pendingPrepareIntents.length > 0) {
                  writeJson(res, 409, { ok: false, error: 'Prepare still has pending review intents.' });
                  return;
                }
                if (!['package', 'youtube'].includes(mode)) {
                  writeJson(res, 400, { ok: false, error: `Unknown publish mode: ${mode}` });
                  return;
                }
                if (!['private', 'unlisted', 'public'].includes(privacy)) {
                  writeJson(res, 400, { ok: false, error: `Unknown privacy: ${privacy}` });
                  return;
                }
                const cliArgs: string[] = [
                  '--import', tsxLoader, arsCliEntrypoint,
                  'publish', mode, target,
                  '--privacy', privacy,
                  '--yes', // client is the source of confirmation; CLI prompt would deadlock
                ];
                if (dryRun) cliArgs.push('--dry-run');
                if (force) cliArgs.push('--force');
                publishJobState = {
                  status: 'running',
                  series, epId,
                  startedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  outputTail: [],
                };
                const child = spawn(process.execPath, cliArgs, {
                  cwd: rootDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
                });
                publishJobProcess = child;
                const appendOutput = (chunk: string) => {
                  const lines = chunk.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
                  if (!lines.length) return;
                  publishJobState = {
                    ...publishJobState,
                    updatedAt: new Date().toISOString(),
                    outputTail: [...(publishJobState.outputTail ?? []), ...lines].slice(-20),
                  };
                };
                child.stdout.on('data', (chunk) => appendOutput(String(chunk)));
                child.stderr.on('data', (chunk) => appendOutput(String(chunk)));
                child.on('close', (code) => {
                  publishJobState = {
                    ...publishJobState,
                    status: code === 0 ? 'succeeded' : 'failed',
                    exitCode: code ?? null,
                    finishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  publishJobProcess = null;
                });
                child.on('error', (error) => {
                  publishJobState = {
                    ...publishJobState,
                    status: 'failed',
                    finishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    outputTail: [...(publishJobState.outputTail ?? []), error.message].slice(-20),
                  };
                  publishJobProcess = null;
                });
                writeJson(res, 202, { ok: true, job: publishJobState });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/plan') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const requestedSeries = asRequiredString(url.searchParams.get('series'), 'series');
                const requestedEpId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const planPath = path.join(rootDir, '.ars', 'episodes', requestedEpId, 'plan.md');
                if (!fs.existsSync(planPath)) {
                  writeJson(res, 404, {
                    ok: false,
                    error: 'plan.md not found',
                    expectedPath: path.relative(rootDir, planPath).split(path.sep).join('/'),
                  });
                  return;
                }
                const stat = fs.statSync(planPath);
                const markdown = fs.readFileSync(planPath, 'utf-8');
                const sections = extractSections(markdown);
                writeJson(res, 200, {
                  ok: true,
                  plan: {
                    series: requestedSeries,
                    epId: requestedEpId,
                    path: path.relative(rootDir, planPath).split(path.sep).join('/'),
                    markdown,
                    mtime: stat.mtimeMs,
                    sections,
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
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

            if (url.pathname === '/__ars/build-trigger') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const body = await readJsonBody(req);
                const seriesIn = asRequiredString(body.series, 'series');
                const epIdIn = asRequiredString(body.epId, 'epId');

                const pending = findPendingBuildTriggerIntent(rootDir, epIdIn);
                if (pending) {
                  writeJson(res, 409, {
                    ok: false,
                    error: 'A build-trigger intent is already pending for this episode.',
                    intentId: pending.id,
                  });
                  return;
                }

                const record = createStudioIntent({
                  target: {
                    series: seriesIn,
                    epId: epIdIn,
                    anchorType: 'episode',
                    anchorId: epIdIn,
                  },
                  source: { ui: 'build' },
                  feedback: {
                    kind: 'build-trigger',
                    message: `Build requested from Studio for ${seriesIn}/${epIdIn}`,
                    severity: 'medium',
                  },
                  rootDir,
                });

                writeJson(res, 202, {
                  ok: true,
                  intentId: record.intent.id,
                  writtenAt: new Date().toISOString(),
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 400, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/build-status') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const requestedSeries = asRequiredString(url.searchParams.get('series'), 'series');
                const requestedEpId = asRequiredString(url.searchParams.get('ep'), 'ep');
                const build = computeBuildStatus(rootDir, requestedSeries, requestedEpId);
                writeJson(res, 200, { ok: true, build });
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

type PublishCapability = {
  visible: boolean;
  enabled: boolean;
  reason?: string;
};

type OnboardStage = 'onboard-walkthrough' | 'onboard-customize' | 'onboard-verify';

type OnboardSessionRecord = {
  active: boolean;
  stage?: OnboardStage;
  series?: string;
  epId?: string;
  startedAt?: string;
  lastSeenAt?: string;
  endedAt?: string;
};

type OnboardStatusPayload = {
  active: boolean;
  stage?: OnboardStage;
  phaseLabel?: string;
  sessionActive: boolean;
  sessionLastSeenAt?: string;
  sessionEndedAt?: string;
  pendingIntents: number;
  previewFingerprint: string;
};

type StudioIntentRecord = {
  id?: string;
  processedAt?: string;
  target?: {
    series?: string;
    epId?: string;
    anchorMeta?: {
      hash?: string;
    };
  };
  feedback?: {
    kind?: string;
  };
};

type EpisodePublishMetadata = {
  youtube?: EpisodeMetadata['youtube'];
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

function persistStudioAttachments(
  body: Record<string, unknown>,
  rootDir: string,
  target: { series: string; epId: string; anchorId: string },
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
      screenshotPath: writeStudioAttachmentFile(rootDir, target, screenshotDataUrl),
    };
  }

  return {
    screenshotPath,
  };
}

function writeStudioAttachmentFile(
  rootDir: string,
  target: { series: string; epId: string; anchorId: string },
  screenshotDataUrl: string,
): string {
  const match = screenshotDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid studio attachment image data.');
  }

  const [, mimeType, base64Payload] = match;
  const extension = imageMimeToExtension(mimeType);
  const attachmentDir = path.join(
    rootDir,
    '.ars',
    'studio-assets',
    sanitizePathToken(target.series),
    sanitizePathToken(target.epId),
  );
  fs.mkdirSync(attachmentDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `${timestamp}-${sanitizePathToken(target.anchorId)}.${extension}`;
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
      throw new Error(`Unsupported studio attachment mime type: ${mimeType}`);
  }
}

function sanitizePathToken(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized.replace(/^-|-$/g, '') || 'attachment';
}

function asStudioUi(value: unknown): 'studio' | 'plan' | 'build' | 'review' | 'prepare' | 'onboard' {
  if (value === 'studio' || value === 'plan' || value === 'build' || value === 'review' || value === 'prepare' || value === 'onboard') {
    return value;
  }
  if (value === 'slides') {
    return 'studio';
  }

  throw new Error('Invalid studio intent source ui.');
}

function asStudioKind(value: unknown): 'visual' | 'content' | 'timing' | 'plan-section' | 'build-trigger' | 'prepare-generate' | 'prepare-select' | 'prepare-edit' | 'prepare-trigger' | 'other' {
  if (
    value === 'visual' ||
    value === 'content' ||
    value === 'timing' ||
    value === 'plan-section' ||
    value === 'build-trigger' ||
    value === 'prepare-generate' ||
    value === 'prepare-select' ||
    value === 'prepare-edit' ||
    value === 'prepare-trigger' ||
    value === 'other'
  ) {
    return value;
  }

  throw new Error('Invalid studio intent feedback kind.');
}

function readStudioIntentRecords(rootDir: string): StudioIntentRecord[] {
  const dir = getStudioIntentsDir(rootDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((fileName) => {
      try {
        const raw = fs.readFileSync(path.join(dir, fileName), 'utf-8');
        return JSON.parse(raw) as StudioIntentRecord;
      } catch {
        return null;
      }
    })
    .filter((record): record is StudioIntentRecord => record !== null);
}

function getPendingPrepareIntents(
  rootDir: string,
  series: string,
  epId: string,
  context?: {
    preparedArtifact: YoutubePrepareArtifact | null;
    episodeMetadata: EpisodePublishMetadata | null;
  },
): StudioIntentRecord[] {
  return readStudioIntentRecords(rootDir).filter((intent) => {
    if (intent.processedAt) return false;
    if (intent.target?.series !== series || intent.target?.epId !== epId) return false;
    const hash = intent.target?.anchorMeta?.hash ?? '';
    if (!hash.startsWith('prepare:')) return false;
    return !isPrepareIntentSatisfied(intent, context);
  });
}

function isPrepareIntentSatisfied(
  intent: StudioIntentRecord,
  context?: {
    preparedArtifact: YoutubePrepareArtifact | null;
    episodeMetadata: EpisodePublishMetadata | null;
  },
): boolean {
  const preparedReady = context?.preparedArtifact?.status === 'ready';
  const metadataApplied = !!context?.episodeMetadata?.youtube;
  const kind = intent.feedback?.kind;
  const hash = intent.target?.anchorMeta?.hash ?? '';

  if (
    preparedReady &&
    (kind === 'prepare-generate' || kind === 'prepare-trigger' || hash === 'prepare:youtube:generate')
  ) {
    return true;
  }

  if (
    metadataApplied &&
    (kind === 'prepare-select' || hash.endsWith(':select'))
  ) {
    return true;
  }

  return false;
}

async function tryLoadEpisodeMetadata(rootDir: string, series: string, epId: string): Promise<EpisodePublishMetadata | null> {
  try {
    const filePath = path.join(rootDir, 'src', 'episodes', series, `${epId}.ts`);
    if (!fs.existsSync(filePath)) return null;
    return readEpisodeMetadataFromSource(filePath);
  } catch {
    return null;
  }
}

function readEpisodeMetadataFromSource(filePath: string): EpisodePublishMetadata | null {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
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

  if (!metadataObject) return null;
  const youtubeObject = getObjectProperty(metadataObject, 'youtube');
  if (!youtubeObject) return {};
  const title = getStringProperty(youtubeObject, 'title');
  const description = getStringProperty(youtubeObject, 'description');
  const tags = getStringArrayProperty(youtubeObject, 'tags');
  if (!title || !description || !tags) return {};
  return { youtube: { title, description, tags } };
}

function getObjectProperty(object: ts.ObjectLiteralExpression, propertyName: string): ts.ObjectLiteralExpression | null {
  const property = object.properties.find((entry) => (
    ts.isPropertyAssignment(entry) &&
    getPropertyNameText(entry.name) === propertyName &&
    ts.isObjectLiteralExpression(entry.initializer)
  ));
  return property && ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)
    ? property.initializer
    : null;
}

function getStringProperty(object: ts.ObjectLiteralExpression, propertyName: string): string | null {
  const property = object.properties.find((entry) => (
    ts.isPropertyAssignment(entry) &&
    getPropertyNameText(entry.name) === propertyName
  ));
  if (!property || !ts.isPropertyAssignment(property)) return null;
  return getStringExpressionValue(property.initializer);
}

function getStringArrayProperty(object: ts.ObjectLiteralExpression, propertyName: string): string[] | null {
  const property = object.properties.find((entry) => (
    ts.isPropertyAssignment(entry) &&
    getPropertyNameText(entry.name) === propertyName &&
    ts.isArrayLiteralExpression(entry.initializer)
  ));
  if (!property || !ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) {
    return null;
  }
  const values = property.initializer.elements.map(getStringExpressionValue);
  return values.every((value): value is string => typeof value === 'string') ? values : null;
}

function getStringExpressionValue(expression: ts.Expression): string | null {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return null;
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function resolvePublishPreview(artifact: YoutubePrepareArtifact | null, episodeYoutube: {
  title: string;
  description: string;
  tags: string[];
} | null): {
  title: string | null;
  description: string | null;
  tags: string[];
  selected: string | null;
  source: string | null;
} {
  if (episodeYoutube) {
    return {
      title: episodeYoutube.title,
      description: episodeYoutube.description,
      tags: episodeYoutube.tags,
      selected: artifact?.youtube.selected ?? null,
      source: 'metadata.youtube',
    };
  }

  return {
    title: null,
    description: null,
    tags: [],
    selected: artifact?.youtube.selected ?? null,
    source: null,
  };
}

function asStudioSeverity(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  throw new Error('Invalid studio intent feedback severity.');
}

function asAnchorType(value: string): StudioIntentAnchorType {
  if (value === 'step' || value === 'card' || value === 'markdown-section' || value === 'plan' || value === 'episode') {
    return value;
  }
  throw new Error(`Invalid anchorType: ${value}`);
}

function parseAnchorMeta(value: unknown): StudioIntentTarget['anchorMeta'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const meta: NonNullable<StudioIntentTarget['anchorMeta']> = {};
  if (typeof record.line === 'number') meta.line = record.line;
  if (typeof record.title === 'string') meta.title = record.title;
  if (typeof record.hash === 'string') meta.hash = record.hash;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

const warnedLegacyPaths = new Set<string>();
function warnLegacy(legacy: string, replacement: string): void {
  if (warnedLegacyPaths.has(legacy)) return;
  warnedLegacyPaths.add(legacy);
  console.warn(`[ars] ${legacy} is deprecated; use ${replacement}.`);
}

function asStepIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Invalid "stepIds" value.');
  }

  const stepIds = value.map((entry) => asRequiredString(entry, 'stepIds[]'));
  return Array.from(new Set(stepIds));
}

function parseStringArray(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0));
}

type BuildStatusResponse = {
  state:
    | 'idle'
    | 'pending-trigger'
    | 'in-progress'
    | 'ready-for-review'
    | 'failed';
  stage?: string;
  pendingIntentId?: string;
  pendingIntentAt?: string;
  episodeSourcePath?: string;
  episodeSourceMtime?: string;
};

function findPendingBuildTriggerIntent(
  rootDir: string,
  epId: string,
): { id: string; writtenAt?: string } | null {
  const dir = getStudioIntentsDir(rootDir);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  for (const fileName of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, fileName), 'utf-8');
      const intent = JSON.parse(raw) as {
        id?: string;
        processedAt?: string;
        target?: { epId?: string };
        feedback?: { kind?: string };
      };
      if (intent.processedAt) continue;
      if (intent.feedback?.kind !== 'build-trigger') continue;
      if (intent.target?.epId !== epId) continue;
      return { id: intent.id ?? fileName.replace(/\.json$/, '') };
    } catch {
      // ignore unreadable intent file
    }
  }
  return null;
}

function readWorkstateStage(rootDir: string): string | undefined {
  try {
    const raw = fs.readFileSync(
      path.join(rootDir, '.ars', 'state', 'workstate.json'),
      'utf-8',
    );
    const parsed = JSON.parse(raw) as { stage?: unknown };
    if (typeof parsed.stage === 'string' && parsed.stage.trim()) {
      return parsed.stage.trim();
    }
  } catch {
    // workstate.json absent is expected
  }
  return undefined;
}

function isOnboardStage(stage?: string): stage is OnboardStage {
  return stage === 'onboard-walkthrough'
    || stage === 'onboard-customize'
    || stage === 'onboard-verify';
}

function getOnboardPhaseLabel(stage?: OnboardStage): string | undefined {
  if (stage === 'onboard-walkthrough') return 'Walkthrough';
  if (stage === 'onboard-customize') return 'Customize';
  if (stage === 'onboard-verify') return 'Verify';
  return undefined;
}

function getOnboardSessionPath(rootDir: string): string {
  return path.join(rootDir, '.ars', 'state', 'onboard-studio-session.json');
}

function readOnboardSession(rootDir: string): OnboardSessionRecord | null {
  try {
    const raw = fs.readFileSync(getOnboardSessionPath(rootDir), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const stage = typeof parsed.stage === 'string' && isOnboardStage(parsed.stage)
      ? parsed.stage
      : undefined;
    return {
      active: parsed.active === true,
      stage,
      series: typeof parsed.series === 'string' ? parsed.series : undefined,
      epId: typeof parsed.epId === 'string' ? parsed.epId : undefined,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : undefined,
      lastSeenAt: typeof parsed.lastSeenAt === 'string' ? parsed.lastSeenAt : undefined,
      endedAt: typeof parsed.endedAt === 'string' ? parsed.endedAt : undefined,
    };
  } catch {
    return null;
  }
}

function writeOnboardSession(rootDir: string, session: OnboardSessionRecord): OnboardSessionRecord {
  const sessionPath = getOnboardSessionPath(rootDir);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf-8');
  return session;
}

function updateOnboardSession(
  rootDir: string,
  update: {
    event: 'open' | 'heartbeat' | 'close';
    stage?: string;
    series?: string;
    epId?: string;
  },
): OnboardSessionRecord {
  const now = new Date().toISOString();
  const current = readOnboardSession(rootDir);
  const stage = isOnboardStage(update.stage) ? update.stage : current?.stage;

  if (update.event === 'close') {
    return writeOnboardSession(rootDir, {
      active: false,
      stage,
      series: update.series ?? current?.series,
      epId: update.epId ?? current?.epId,
      startedAt: current?.startedAt,
      lastSeenAt: current?.lastSeenAt ?? now,
      endedAt: now,
    });
  }

  return writeOnboardSession(rootDir, {
    active: true,
    stage,
    series: update.series ?? current?.series,
    epId: update.epId ?? current?.epId,
    startedAt: current?.startedAt ?? now,
    lastSeenAt: now,
    endedAt: undefined,
  });
}

function countPendingStudioIntents(rootDir: string, series: string, epId: string): number {
  const studioDir = getStudioIntentsDir(rootDir);
  if (!fs.existsSync(studioDir)) return 0;

  return fs.readdirSync(studioDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .reduce((count, fileName) => {
      try {
        const raw = fs.readFileSync(path.join(studioDir, fileName), 'utf-8');
        const intent = JSON.parse(raw) as {
          processedAt?: string;
          target?: { series?: string; epId?: string };
        };
        if (intent.processedAt) return count;
        if (intent.target?.series !== series) return count;
        if (intent.target?.epId !== epId) return count;
        return count + 1;
      } catch {
        return count;
      }
    }, 0);
}

function collectFingerprintEntries(basePath: string, prefix: string, entries: string[]): void {
  if (!fs.existsSync(basePath)) {
    entries.push(`${prefix}:missing`);
    return;
  }

  const stat = fs.statSync(basePath);
  if (stat.isFile()) {
    entries.push(`${prefix}@${stat.mtimeMs}`);
    return;
  }

  entries.push(`${prefix}/@${stat.mtimeMs}`);
  for (const entry of fs.readdirSync(basePath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    collectFingerprintEntries(path.join(basePath, entry.name), `${prefix}/${entry.name}`, entries);
  }
}

function computeReviewPreviewFingerprint(rootDir: string, series: string, epId: string): string {
  const entries: string[] = [];
  collectFingerprintEntries(
    path.join(rootDir, 'src', 'episodes', series, `${epId}.ts`),
    `src/episodes/${series}/${epId}.ts`,
    entries,
  );
  collectFingerprintEntries(
    path.join(rootDir, 'src', 'episodes', series, 'series-config.ts'),
    `src/episodes/${series}/series-config.ts`,
    entries,
  );
  collectFingerprintEntries(path.join(rootDir, 'SERIES_GUIDE.md'), 'SERIES_GUIDE.md', entries);
  collectFingerprintEntries(
    path.join(rootDir, 'public', 'episodes', series, 'shared'),
    `public/episodes/${series}/shared`,
    entries,
  );
  return entries.join('|');
}

function resolveOnboardStatus(rootDir: string, series: string, epId: string): OnboardStatusPayload {
  const stageRaw = readWorkstateStage(rootDir);
  const stage = isOnboardStage(stageRaw) ? stageRaw : undefined;
  const active = !!stage;
  let session = readOnboardSession(rootDir);
  const pendingIntents = active ? countPendingStudioIntents(rootDir, series, epId) : 0;

  if (session?.active && !active) {
    session = updateOnboardSession(rootDir, { event: 'close', series, epId, stage: stageRaw });
  }

  return {
    active,
    stage,
    phaseLabel: getOnboardPhaseLabel(stage),
    sessionActive: session?.active === true && active,
    sessionLastSeenAt: session?.lastSeenAt,
    sessionEndedAt: session?.endedAt,
    pendingIntents,
    previewFingerprint: active ? computeReviewPreviewFingerprint(rootDir, series, epId) : '',
  };
}

function computeBuildStatus(rootDir: string, series: string, epId: string): BuildStatusResponse {
  const result: BuildStatusResponse = { state: 'idle' };

  const episodeFile = path.join(rootDir, 'src', 'episodes', series, `${epId}.ts`);
  if (fs.existsSync(episodeFile)) {
    const stat = fs.statSync(episodeFile);
    result.episodeSourcePath = path.relative(rootDir, episodeFile).split(path.sep).join('/');
    result.episodeSourceMtime = new Date(stat.mtimeMs).toISOString();
    result.state = 'ready-for-review';
  }

  const stage = readWorkstateStage(rootDir);
  if (stage) {
    result.stage = stage;
    if (stage === `failed:${epId}`) {
      result.state = 'failed';
    } else if (stage === `building:${epId}` || stage === `validating:${epId}`) {
      result.state = 'in-progress';
    } else if (stage === `blocked:${epId}:assets-missing`) {
      result.state = 'failed';
    } else if (stage === `ready-for-review:${epId}` && result.episodeSourcePath) {
      result.state = 'ready-for-review';
    }
  }

  const pending = findPendingBuildTriggerIntent(rootDir, epId);
  if (pending) {
    result.pendingIntentId = pending.id;
    if (result.state === 'idle' || result.state === 'ready-for-review') {
      result.state = 'pending-trigger';
    }
  }

  return result;
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
  if (!speechConfig.enabled) {
    return {
      visible: false,
      enabled: false,
      reason: 'Audio/TTS 已在 series-config.ts 停用。',
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

function resolvePublishCapability(rootDir: string): PublishCapability {
  const config = readLocalArsConfig(rootDir);
  if (!config) {
    return {
      visible: false,
      enabled: false,
      reason: '尚未初始化 ARS 設定；先執行 ars init <series>。',
    };
  }

  if (!config.publish.youtube.enabled) {
    return {
      visible: false,
      enabled: false,
      reason: 'YouTube publish 已在 init 設定中停用。',
    };
  }

  return { visible: true, enabled: true };
}

function readSeriesSpeechSummary(rootDir: string, series: string): {
  enabled: boolean;
  provider: SpeechProviderId | null;
  hasDefaultVoice: boolean;
  reviewRequiresNativeTiming: boolean;
} {
  const seriesConfigPath = path.join(rootDir, 'src', 'episodes', series, 'series-config.ts');
  if (!fs.existsSync(seriesConfigPath)) {
    return {
      enabled: true,
      provider: null,
      hasDefaultVoice: false,
      reviewRequiresNativeTiming: true,
    };
  }

  try {
    const content = fs.readFileSync(seriesConfigPath, 'utf-8');
    const enabledMatch = content.match(/speech:\s*{[\s\S]*?enabled:\s*(true|false)/);
    const providerMatch = content.match(/speech:\s*{[\s\S]*?provider:\s*['"](minimax|elevenlabs)['"]/);
    const reviewMatch = content.match(/speech:\s*{[\s\S]*?reviewRequiresNativeTiming:\s*(true|false)/);
    return {
      enabled: enabledMatch?.[1] !== 'false',
      provider: (providerMatch?.[1] as SpeechProviderId | undefined) ?? null,
      hasDefaultVoice: /voice:\s*['"][^'"]+['"]/.test(content),
      reviewRequiresNativeTiming: reviewMatch?.[1] !== 'false',
    };
  } catch {
    return {
      enabled: true,
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
    const publish = (
      record.publish && typeof record.publish === 'object' && !Array.isArray(record.publish)
        ? record.publish
        : {}
    ) as Record<string, unknown>;
    const youtube = (
      publish.youtube && typeof publish.youtube === 'object' && !Array.isArray(publish.youtube)
        ? publish.youtube
        : {}
    ) as Record<string, unknown>;
    const project = (
      record.project && typeof record.project === 'object' && !Array.isArray(record.project)
        ? record.project
        : {}
    ) as Record<string, unknown>;

    return {
      publish: {
        youtube: {
          enabled: youtube.enabled === true,
        },
      },
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
  publish: {
    youtube: {
      enabled: boolean;
    };
  };
  project: {
    activeSeries?: string;
  };
};
