export interface ReviewIntentTarget {
  series: string;
  epId: string;
  stepId: string;
}

export interface ReviewIntentSource {
  ui: 'studio';
  hash?: string;
}

export interface ReviewIntentFeedback {
  kind: 'visual' | 'content' | 'timing' | 'other';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ReviewIntentAttachments {
  screenshotPath?: string;
  screenshotDataUrl?: string;
}

export interface ReviewIntent {
  version: 1;
  id: string;
  target: ReviewIntentTarget;
  source: ReviewIntentSource;
  feedback: ReviewIntentFeedback;
  attachments?: ReviewIntentAttachments;
  processedAt?: string;
}
