import type { ReviewIntentFeedback } from '../../types/review-intent';

export const EPISODE_SCOPE_ID = '__episode__';

export const INTENT_SUBMITTED_EVENT = 'ars:intent-submitted';

export const KIND_LABELS: Record<ReviewIntentFeedback['kind'], string> = {
  visual: '卡片',
  content: '口播',
  other: '整集',
  timing: '時序',
  'plan-section': '段落',
};
