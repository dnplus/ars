import fs from 'fs';
import path from 'path';

export const CONFIG_SCHEMA_VERSION = 2;
export const TTS_PROVIDER_IDS = ['none', 'minimax'] as const;
export const REVIEW_UI_IDS = ['studio'] as const;
export const VISUAL_DENSITY_IDS = ['minimal', 'balanced', 'dense'] as const;
export const LAYOUT_BIAS_IDS = ['mixed', 'title-card', 'card-only', 'fullscreen'] as const;

export type TTSProviderId = (typeof TTS_PROVIDER_IDS)[number];
export type ReviewUiId = (typeof REVIEW_UI_IDS)[number];
export type VisualDensityId = (typeof VISUAL_DENSITY_IDS)[number];
export type LayoutBiasId = (typeof LAYOUT_BIAS_IDS)[number];

export interface ArsConfig {
  version: number;
  tts: {
    provider: TTSProviderId;
  };
  publish: {
    youtube: {
      enabled: boolean;
      credentialsPath?: string;
      clientSecretPath?: string;
    };
  };
  extensions: {
    analytics: {
      enabled: boolean;
    };
  };
  review: {
    preferredUi: ReviewUiId;
  };
  project: {
    activeSeries?: string;
    channelName?: string;
    visualDirection?: string;
    tone?: string;
    mascot?: string;
    visualDensity: VisualDensityId;
    layoutBias: LayoutBiasId;
  };
}

interface JsonRecord {
  [key: string]: unknown;
}

export function getRepoRoot(): string {
  return process.cwd();
}

export function getArsDir(root = getRepoRoot()): string {
  return path.join(root, '.ars');
}

export function getConfigPath(root = getRepoRoot()): string {
  return path.join(getArsDir(root), 'config.json');
}

export function createDefaultConfig(): ArsConfig {
  return {
    version: CONFIG_SCHEMA_VERSION,
    tts: {
      provider: 'none',
    },
    publish: {
      youtube: {
        enabled: false,
        credentialsPath: '.ars/credentials/youtube/credentials.json',
        clientSecretPath: '.ars/credentials/youtube/client_secret.json',
      },
    },
    extensions: {
      analytics: {
        enabled: false,
      },
    },
    review: {
      preferredUi: 'studio',
    },
    project: {
      activeSeries: undefined,
      channelName: undefined,
      visualDirection: undefined,
      tone: undefined,
      mascot: undefined,
      visualDensity: 'balanced',
      layoutBias: 'mixed',
    },
  };
}

export function ensureArsDir(root = getRepoRoot()): string {
  const arsDir = getArsDir(root);
  fs.mkdirSync(arsDir, { recursive: true });
  return arsDir;
}

export function writeArsConfig(config: ArsConfig, root = getRepoRoot()): string {
  ensureArsDir(root);
  const configPath = getConfigPath(root);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  return configPath;
}

export function readRawArsConfig(root = getRepoRoot()): unknown {
  const configPath = getConfigPath(root);
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as unknown;
}

export function readArsConfig(root = getRepoRoot()): ArsConfig {
  return parseArsConfig(readRawArsConfig(root));
}

export function configExists(root = getRepoRoot()): boolean {
  return fs.existsSync(getConfigPath(root));
}

export function parseArsConfig(input: unknown): ArsConfig {
  const defaults = createDefaultConfig();
  if (!isRecord(input)) {
    throw new Error('Config root must be an object.');
  }

  const publish = isRecord(input.publish) ? input.publish : {};
  const youtube = isRecord(publish.youtube) ? publish.youtube : {};
  const extensions = isRecord(input.extensions) ? input.extensions : {};
  const analytics = isRecord(extensions.analytics) ? extensions.analytics : {};
  const review = isRecord(input.review) ? input.review : {};
  const project = isRecord(input.project) ? input.project : {};
  const normalizedPreferredUi = review.preferredUi === 'slides' ? 'studio' : review.preferredUi;

  return {
    version:
      typeof input.version === 'number' && Number.isFinite(input.version)
        ? input.version
        : CONFIG_SCHEMA_VERSION,
    tts: {
      provider:
        expectOptionalOneOf(ttsProviderValue(input), TTS_PROVIDER_IDS, 'tts.provider') ??
        defaults.tts.provider,
    },
    publish: {
      youtube: {
        enabled:
          expectOptionalBoolean(youtube.enabled, 'publish.youtube.enabled') ??
          defaults.publish.youtube.enabled,
        credentialsPath:
          expectOptionalString(
            youtube.credentialsPath,
            'publish.youtube.credentialsPath',
          ) ?? defaults.publish.youtube.credentialsPath,
        clientSecretPath:
          expectOptionalString(
            youtube.clientSecretPath,
            'publish.youtube.clientSecretPath',
          ) ?? defaults.publish.youtube.clientSecretPath,
      },
    },
    extensions: {
      analytics: {
        enabled:
          expectOptionalBoolean(analytics.enabled, 'extensions.analytics.enabled') ??
          defaults.extensions.analytics.enabled,
      },
    },
    review: {
      preferredUi:
        expectOptionalOneOf(normalizedPreferredUi, REVIEW_UI_IDS, 'review.preferredUi') ??
        defaults.review.preferredUi,
    },
    project: {
      activeSeries:
        expectOptionalString(project.activeSeries, 'project.activeSeries') ??
        defaults.project.activeSeries,
      channelName:
        expectOptionalString(project.channelName, 'project.channelName') ??
        defaults.project.channelName,
      visualDirection:
        expectOptionalString(project.visualDirection, 'project.visualDirection') ??
        defaults.project.visualDirection,
      tone:
        expectOptionalString(project.tone, 'project.tone') ??
        defaults.project.tone,
      mascot:
        expectOptionalString(project.mascot, 'project.mascot') ??
        defaults.project.mascot,
      visualDensity:
        expectOptionalOneOf(
          project.visualDensity,
          VISUAL_DENSITY_IDS,
          'project.visualDensity',
        ) ?? defaults.project.visualDensity,
      layoutBias:
        expectOptionalOneOf(
          project.layoutBias,
          LAYOUT_BIAS_IDS,
          'project.layoutBias',
        ) ?? defaults.project.layoutBias,
    },
  };
}

function ttsProviderValue(input: JsonRecord): unknown {
  if (!isRecord(input.tts)) {
    return undefined;
  }
  return input.tts.provider;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Config field "${field}" must be a boolean.`);
  }

  return value;
}

function expectOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Config field "${field}" must be a string when provided.`);
  }

  return value;
}

function expectOptionalStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Config field "${field}" must be an array of strings.`);
  }

  return value;
}

function expectOptionalOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !allowed.includes(value as T[number])) {
    throw new Error(
      `Config field "${field}" must be one of: ${allowed.join(', ')}.`,
    );
  }

  return value as T[number];
}
