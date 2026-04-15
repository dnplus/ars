export interface TTSOptions {
  voiceId?: string;
  cloneId?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  outputFormat?: 'mp3' | 'wav';
  enableSubtitle?: boolean;
  subtitleOutputPath?: string;
  pronunciationDictionary?: string[];
}

export interface PublishArtifact {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  thumbnailPath?: string;
  captionPath?: string;
  categoryId?: string;
  language?: string;
  madeForKids?: boolean;
  isShort?: boolean;
}

export interface PublishOptions {
  privacyStatus?: 'public' | 'unlisted' | 'private';
  publishAt?: string;
  notifySubscribers?: boolean;
  dryRun?: boolean;
  workingDirectory?: string;
  metadata?: Record<string, string>;
}

export interface PublishResult {
  platformId: string;
  remoteId: string;
  url?: string;
  uploadedAt: string;
  dryRun: boolean;
  metadata: Record<string, string>;
}

export interface ITTSAdapter {
  readonly providerId: string;
  readonly supportedVoices: string[];

  synthesize(text: string, options: TTSOptions): Promise<Buffer>;
}

export interface IPublishAdapter {
  readonly platformId: string;

  upload(artifact: PublishArtifact, options: PublishOptions): Promise<PublishResult>;
}
