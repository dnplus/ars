/**
 * @deprecated Renamed to studio-intents. This module re-exports the new
 * functions under the legacy review-intent names for backwards compatibility.
 * Import from `src/studio/studio-intents` for new code.
 */
import {
  type CreateStudioIntentInput,
  type StudioIntentRecord,
  createStudioIntent,
  ensureStudioIntentsDir,
  formatStudioIntentId,
  getStudioIntentFilePath,
  getStudioIntentsDir,
  listStudioIntentRecords,
  markAllStudioIntentsProcessed,
  markStudioIntentProcessed,
  readStudioIntent,
  writeStudioIntent,
} from '../studio/studio-intents';

export type ReviewIntentRecord = StudioIntentRecord;
export type CreateReviewIntentInput = CreateStudioIntentInput;

export const getReviewIntentsDir = getStudioIntentsDir;
export const ensureReviewIntentsDir = ensureStudioIntentsDir;
export const getReviewIntentFilePath = getStudioIntentFilePath;
export const formatReviewIntentId = formatStudioIntentId;
export const createReviewIntent = createStudioIntent;
export const writeReviewIntent = writeStudioIntent;
export const readReviewIntent = readStudioIntent;
export const listReviewIntentRecords = listStudioIntentRecords;
export const markReviewIntentProcessed = markStudioIntentProcessed;
export const markAllReviewIntentsProcessed = markAllStudioIntentsProcessed;
