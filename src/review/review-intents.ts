import fs from 'fs';
import path from 'path';
import type {
  ReviewIntent,
  ReviewIntentAttachments,
  ReviewIntentFeedback,
  ReviewIntentSource,
  ReviewIntentTarget,
} from '../types/review-intent';

export interface ReviewIntentRecord {
  intent: ReviewIntent;
  filePath: string;
}

export interface CreateReviewIntentInput {
  target: ReviewIntentTarget;
  source: ReviewIntentSource;
  feedback: ReviewIntentFeedback;
  attachments?: ReviewIntentAttachments;
  rootDir?: string;
  now?: Date;
}

export function getReviewIntentsDir(rootDir = process.cwd()): string {
  return path.join(rootDir, '.ars', 'review-intents');
}

export function ensureReviewIntentsDir(rootDir = process.cwd()): string {
  const reviewDir = getReviewIntentsDir(rootDir);
  fs.mkdirSync(reviewDir, { recursive: true });
  return reviewDir;
}

export function getReviewIntentFilePath(id: string, rootDir = process.cwd()): string {
  return path.join(ensureReviewIntentsDir(rootDir), `${id}.json`);
}

export function formatReviewIntentId(stepId: string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${timestamp}-${stepId}`;
}

export function createReviewIntent(input: CreateReviewIntentInput): ReviewIntentRecord {
  const rootDir = input.rootDir ?? process.cwd();
  const intent: ReviewIntent = {
    version: 1,
    id: formatReviewIntentId(input.target.stepId, input.now),
    target: input.target,
    source: input.source,
    feedback: input.feedback,
    attachments: input.attachments,
  };

  return writeReviewIntent(intent, rootDir);
}

export function writeReviewIntent(intent: ReviewIntent, rootDir = process.cwd()): ReviewIntentRecord {
  const filePath = getReviewIntentFilePath(intent.id, rootDir);
  fs.writeFileSync(filePath, `${JSON.stringify(intent, null, 2)}\n`, 'utf-8');
  return { intent, filePath };
}

export function readReviewIntent(id: string, rootDir = process.cwd()): ReviewIntentRecord {
  const filePath = getReviewIntentFilePath(id, rootDir);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Review intent not found: ${id}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return {
    intent: JSON.parse(raw) as ReviewIntent,
    filePath,
  };
}

export function listReviewIntentRecords(rootDir = process.cwd()): ReviewIntentRecord[] {
  const reviewDir = ensureReviewIntentsDir(rootDir);
  const fileNames = fs.readdirSync(reviewDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));

  return fileNames.map((fileName) => {
    const filePath = path.join(reviewDir, fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');

    return {
      intent: JSON.parse(raw) as ReviewIntent,
      filePath,
    };
  });
}

export function markReviewIntentProcessed(
  id: string,
  rootDir = process.cwd(),
  processedAt = new Date().toISOString(),
): ReviewIntentRecord {
  const record = readReviewIntent(id, rootDir);
  const updated: ReviewIntent = {
    ...record.intent,
    processedAt,
  };

  return writeReviewIntent(updated, rootDir);
}

export function markAllReviewIntentsProcessed(
  rootDir = process.cwd(),
  processedAt = new Date().toISOString(),
): ReviewIntentRecord[] {
  return listReviewIntentRecords(rootDir).map(({ intent }) =>
    writeReviewIntent(
      {
        ...intent,
        processedAt: intent.processedAt ?? processedAt,
      },
      rootDir,
    ),
  );
}
