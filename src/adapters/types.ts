import type {
  SpeechAudioFormat,
  SpeechProviderId,
  SpeechSpec,
} from '../engine/shared/types';

export type TTSProviderCapabilities = {
  syncSynthesis: true;
  nativeTiming: boolean;
  pronunciationDictionary: boolean;
  numericProsody: boolean;
  voiceCloning: boolean;
  asyncLongForm: boolean;
  supportedFormats: SpeechAudioFormat[];
};

export type TTSSynthesizeInput = {
  text: string;
  speech: SpeechSpec;
  wantTiming?: boolean;
};

export type TTSTimingPhrase = {
  text: string;
  startTime: number;
  endTime: number;
};

export type TTSSynthesizeResult = {
  providerId: SpeechProviderId;
  modelId: string;
  voiceRef?: string;
  audio: Buffer;
  audioFormat: SpeechAudioFormat;
  durationMs?: number;
  timing?: {
    source: 'provider-native';
    phrases: TTSTimingPhrase[];
  };
  usage?: {
    characters?: number;
  };
  providerMetadata?: Record<string, unknown>;
};

export interface ITTSVoiceCloneAdapter {
  cloneVoice(...args: never[]): Promise<never>;
}

export interface ITTSLongFormAdapter {
  createTask(...args: never[]): Promise<never>;
  getTask(...args: never[]): Promise<never>;
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
  readonly providerId: SpeechProviderId;

  getCapabilities(): TTSProviderCapabilities;
  synthesize(input: TTSSynthesizeInput): Promise<TTSSynthesizeResult>;
}

export interface IPublishAdapter {
  readonly platformId: string;

  upload(artifact: PublishArtifact, options: PublishOptions): Promise<PublishResult>;
}
