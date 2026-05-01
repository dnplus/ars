import fs from 'fs';
import path from 'path';
import type {
  StudioIntent,
  StudioIntentAttachments,
  StudioIntentFeedback,
  StudioIntentResolution,
  StudioIntentSource,
  StudioIntentTarget,
} from '../types/studio-intent';

export interface StudioIntentRecord {
  intent: StudioIntent;
  filePath: string;
}

export interface CreateStudioIntentInput {
  target: StudioIntentTarget | LegacyStudioIntentTarget;
  source: StudioIntentSource;
  feedback: StudioIntentFeedback;
  attachments?: StudioIntentAttachments;
  rootDir?: string;
  now?: Date;
}

export type ResolveStudioIntentInput = Omit<StudioIntentResolution, 'processedAt'> & {
  processedAt?: string;
};

/**
 * Legacy callers may pass `{ series, epId, stepId }` without `anchorType`/`anchorId`.
 * Normalized inside `createStudioIntent` to `anchorType: 'step'`, `anchorId: stepId`.
 */
type LegacyStudioIntentTarget = Omit<StudioIntentTarget, 'anchorType' | 'anchorId'> & {
  anchorType?: StudioIntentTarget['anchorType'];
  anchorId?: string;
};

function normalizeTarget(target: StudioIntentTarget | LegacyStudioIntentTarget): StudioIntentTarget {
  if (target.anchorType && target.anchorId) {
    return target as StudioIntentTarget;
  }
  const stepId = target.stepId;
  if (!stepId) {
    throw new Error('StudioIntentTarget requires either { anchorType, anchorId } or legacy { stepId }.');
  }
  return {
    ...target,
    anchorType: target.anchorType ?? 'step',
    anchorId: target.anchorId ?? stepId,
    stepId,
  };
}

export function getStudioIntentsDir(rootDir = process.cwd()): string {
  return path.join(rootDir, '.ars', 'studio-intents');
}

export function ensureStudioIntentsDir(rootDir = process.cwd()): string {
  const dir = getStudioIntentsDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getStudioIntentFilePath(id: string, rootDir = process.cwd()): string {
  return path.join(ensureStudioIntentsDir(rootDir), `${id}.json`);
}

export function formatStudioIntentId(anchorId: string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const safeAnchor = anchorId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'anchor';
  return `${timestamp}-${safeAnchor}`;
}

export function createStudioIntent(input: CreateStudioIntentInput): StudioIntentRecord {
  const rootDir = input.rootDir ?? process.cwd();
  const target = normalizeTarget(input.target);
  const intent: StudioIntent = {
    version: 1,
    id: formatStudioIntentId(target.anchorId, input.now),
    target,
    source: input.source,
    feedback: input.feedback,
    attachments: input.attachments,
  };

  return writeStudioIntent(intent, rootDir);
}

export function writeStudioIntent(intent: StudioIntent, rootDir = process.cwd()): StudioIntentRecord {
  const filePath = getStudioIntentFilePath(intent.id, rootDir);
  fs.writeFileSync(filePath, `${JSON.stringify(intent, null, 2)}\n`, 'utf-8');
  return { intent, filePath };
}

export function readStudioIntent(id: string, rootDir = process.cwd()): StudioIntentRecord {
  const filePath = getStudioIntentFilePath(id, rootDir);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Studio intent not found: ${id}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return {
    intent: JSON.parse(raw) as StudioIntent,
    filePath,
  };
}

export function listStudioIntentRecords(rootDir = process.cwd()): StudioIntentRecord[] {
  const dir = ensureStudioIntentsDir(rootDir);
  const fileNames = fs.readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));

  return fileNames.flatMap((fileName) => {
    const filePath = path.join(dir, fileName);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return [{
        intent: JSON.parse(raw) as StudioIntent,
        filePath,
      }];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ars] skipping malformed studio intent ${fileName}: ${message}`);
      return [];
    }
  });
}

export function markStudioIntentProcessed(
  id: string,
  rootDir = process.cwd(),
  processedAt = new Date().toISOString(),
): StudioIntentRecord {
  const record = readStudioIntent(id, rootDir);
  const updated: StudioIntent = {
    ...record.intent,
    processedAt,
  };

  return writeStudioIntent(updated, rootDir);
}

export function resolveStudioIntent(
  id: string,
  resolution: ResolveStudioIntentInput,
  rootDir = process.cwd(),
): StudioIntentRecord {
  const processedAt = resolution.processedAt ?? new Date().toISOString();
  const record = readStudioIntent(id, rootDir);
  const updated: StudioIntent = {
    ...record.intent,
    processedAt,
    resolution: {
      ...resolution,
      processedAt,
    },
  };

  return writeStudioIntent(updated, rootDir);
}

export function markAllStudioIntentsProcessed(
  rootDir = process.cwd(),
  processedAt = new Date().toISOString(),
): StudioIntentRecord[] {
  return listStudioIntentRecords(rootDir).map(({ intent }) =>
    writeStudioIntent(
      {
        ...intent,
        processedAt: intent.processedAt ?? processedAt,
      },
      rootDir,
    ),
  );
}
