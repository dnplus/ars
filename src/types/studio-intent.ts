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
  ui: 'studio' | 'plan' | 'build' | 'review' | 'prepare';
  hash?: string;
}

export interface StudioIntentFeedback {
  kind:
    | 'visual'
    | 'content'
    | 'timing'
    | 'plan-section'
    | 'build-trigger'
    | 'prepare-generate'
    | 'prepare-select'
    | 'prepare-edit'
    /** @deprecated Use prepare-generate, prepare-select, or prepare-edit. */
    | 'prepare-trigger'
    | 'other';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface StudioIntentAttachments {
  screenshotPath?: string;
  screenshotDataUrl?: string;
}

export interface StudioIntentResolution {
  processedAt: string;
  processor?: string;
  changedFiles?: string[];
  summary: string;
  beforeExcerpt?: string;
  afterExcerpt?: string;
  diffPath?: string;
  validation?: string;
}

export interface StudioIntent {
  version: 1;
  id: string;
  target: StudioIntentTarget;
  source: StudioIntentSource;
  feedback: StudioIntentFeedback;
  attachments?: StudioIntentAttachments;
  processedAt?: string;
  resolution?: StudioIntentResolution;
}
