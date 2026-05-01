import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { listStudioIntentRecords, writeStudioIntent } from '../../src/studio/studio-intents';
import { readPrepareArtifact } from '../../src/studio/prepare-youtube-artifact';
import type { StudioIntent } from '../../src/types/studio-intent';
import type { EpisodeMetadata } from '../../src/engine/shared/types';

export interface StateMigrationResult {
  prepareIntentsNormalized: number;
  prepareIntentsResolved: number;
}

type EpisodeContext = {
  prepareReady: boolean;
  metadataApplied: boolean;
};

export async function migrateArsState(rootDir = process.cwd()): Promise<StateMigrationResult> {
  const result: StateMigrationResult = {
    prepareIntentsNormalized: 0,
    prepareIntentsResolved: 0,
  };
  const contextCache = new Map<string, Promise<EpisodeContext>>();

  for (const { intent } of listStudioIntentRecords(rootDir)) {
    const hash = intent.target?.anchorMeta?.hash ?? '';
    if (!hash.startsWith('prepare:')) continue;

    const episodeKey = `${intent.target.series}/${intent.target.epId}`;
    const context = await getEpisodeContext(rootDir, intent.target.series, intent.target.epId, contextCache);
    const next = normalizePrepareIntent(intent);
    if (next !== intent) result.prepareIntentsNormalized += 1;

    if (!next.processedAt && isPrepareIntentSatisfied(next, context)) {
      const processedAt = new Date().toISOString();
      writeStudioIntent({
        ...next,
        processedAt,
        resolution: {
          processedAt,
          processor: 'ars-update',
          summary: `Resolved by ars update migration: prepare state is already satisfied for ${episodeKey}.`,
          validation: context.metadataApplied
            ? 'episode metadata.youtube exists'
            : 'prepare-youtube artifact is ready',
        },
      }, rootDir);
      result.prepareIntentsResolved += 1;
      continue;
    }

    if (next !== intent) {
      writeStudioIntent(next, rootDir);
    }
  }

  return result;
}

function normalizePrepareIntent(intent: StudioIntent): StudioIntent {
  if (intent.feedback.kind !== 'prepare-trigger') return intent;
  const hash = intent.target?.anchorMeta?.hash ?? '';
  const kind = hash.endsWith(':select')
    ? 'prepare-select'
    : hash.includes(':title') || hash.includes(':description') || hash.includes(':tags') || hash.includes(':card')
      ? 'prepare-edit'
      : 'prepare-generate';

  return {
    ...intent,
    feedback: {
      ...intent.feedback,
      kind,
    },
  };
}

function isPrepareIntentSatisfied(intent: StudioIntent, context: EpisodeContext): boolean {
  const kind = intent.feedback.kind;
  const hash = intent.target?.anchorMeta?.hash ?? '';

  if (
    context.prepareReady &&
    (kind === 'prepare-generate' || kind === 'prepare-trigger' || hash === 'prepare:youtube:generate')
  ) {
    return true;
  }

  if (
    context.metadataApplied &&
    (kind === 'prepare-select' || hash.endsWith(':select'))
  ) {
    return true;
  }

  return false;
}

function getEpisodeContext(
  rootDir: string,
  series: string,
  epId: string,
  cache: Map<string, Promise<EpisodeContext>>,
): Promise<EpisodeContext> {
  const key = `${series}/${epId}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = readEpisodeContext(rootDir, series, epId);
    cache.set(key, promise);
  }
  return promise;
}

async function readEpisodeContext(rootDir: string, series: string, epId: string): Promise<EpisodeContext> {
  const artifact = readPrepareArtifact(rootDir, series, epId);
  const metadata = await tryLoadEpisodeMetadata(rootDir, series, epId);
  return {
    prepareReady: artifact?.status === 'ready',
    metadataApplied: !!metadata?.youtube,
  };
}

async function tryLoadEpisodeMetadata(rootDir: string, series: string, epId: string): Promise<EpisodeMetadata | null> {
  try {
    const filePath = path.join(rootDir, 'src', 'episodes', series, `${epId}.ts`);
    if (!fs.existsSync(filePath)) return null;
    const mod = await import(`${pathToFileURL(filePath).href}?t=${fs.statSync(filePath).mtimeMs}`);
    const camelId = epId.replace(/-([a-z0-9])/g, (_: string, c: string) => c.toUpperCase());
    const defaultExport = mod.default as Record<string, unknown> | undefined;
    const episode = mod[camelId] ?? mod[epId] ?? defaultExport?.[camelId] ?? defaultExport?.[epId] ?? mod.default;
    return episode?.metadata ?? null;
  } catch {
    return null;
  }
}
