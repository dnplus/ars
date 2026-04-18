/**
 * @deprecated Renamed to StudioIntent. This module re-exports the new types
 * under the legacy ReviewIntent names for backwards compatibility. Import from
 * `src/types/studio-intent` for new code.
 */
import type {
  StudioIntent,
  StudioIntentAttachments,
  StudioIntentFeedback,
  StudioIntentSource,
  StudioIntentTarget,
} from './studio-intent';

export type ReviewIntent = StudioIntent;
/**
 * Legacy target shape: callers may pass `{ series, epId, stepId }` and the
 * intent store will normalize to `{ anchorType: 'step', anchorId: stepId }`.
 */
export type ReviewIntentTarget = Omit<StudioIntentTarget, 'anchorType' | 'anchorId'> & {
  anchorType?: StudioIntentTarget['anchorType'];
  anchorId?: string;
};
export type ReviewIntentSource = StudioIntentSource;
export type ReviewIntentFeedback = StudioIntentFeedback;
export type ReviewIntentAttachments = StudioIntentAttachments;
