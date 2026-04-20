export type StudioIntentAnchorType =
  | 'step'
  | 'card'
  | 'markdown-section'
  | 'plan'
  | 'episode';

export interface StudioIntentAnchorMeta {
  line?: number;
  title?: string;
  hash?: string;
}

export interface StudioIntentTarget {
  series: string;
  epId: string;
  anchorType: StudioIntentAnchorType;
  anchorId: string;
  anchorMeta?: StudioIntentAnchorMeta;
  /** @deprecated Use `anchorType: 'step'` + `anchorId`. Retained for legacy reads. */
  stepId?: string;
}

export interface StudioIntentSource {
  ui: 'studio' | 'plan' | 'build' | 'review';
  hash?: string;
}

export interface StudioIntentFeedback {
  kind: 'visual' | 'content' | 'timing' | 'plan-section' | 'build-trigger' | 'other';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface StudioIntentAttachments {
  screenshotPath?: string;
  screenshotDataUrl?: string;
}

export interface StudioIntent {
  version: 1;
  id: string;
  target: StudioIntentTarget;
  source: StudioIntentSource;
  feedback: StudioIntentFeedback;
  attachments?: StudioIntentAttachments;
  processedAt?: string;
}
