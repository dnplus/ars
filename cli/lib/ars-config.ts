import fs from 'fs';
import path from 'path';

export const LLM_PROVIDER_IDS = ['anthropic', 'openai', 'noop'] as const;
export const TTS_PROVIDER_IDS = ['none', 'minimax'] as const;
export const REVIEW_UI_IDS = ['slides'] as const;

export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number];
export type TTSProviderId = (typeof TTS_PROVIDER_IDS)[number];
export type ReviewUiId = (typeof REVIEW_UI_IDS)[number];

export interface ArsConfig {
  llm: {
    default: LLMProviderId;
    fallbacks: LLMProviderId[];
  };
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
    social: {
      enabled: boolean;
    };
    analytics: {
      enabled: boolean;
    };
  };
  review: {
    preferredUi: ReviewUiId;
    enableExperimentalStudio: boolean;
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
    llm: {
      default: 'anthropic',
      fallbacks: ['openai'],
    },
    tts: {
      provider: 'none',
    },
    publish: {
      youtube: {
        enabled: true,
        credentialsPath: '.ars/credentials/youtube/credentials.json',
        clientSecretPath: '.ars/credentials/youtube/client_secret.json',
      },
    },
    extensions: {
      social: {
        enabled: false,
      },
      analytics: {
        enabled: false,
      },
    },
    review: {
      preferredUi: 'slides',
      enableExperimentalStudio: false,
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

export function readArsConfig(root = getRepoRoot()): ArsConfig {
  const configPath = getConfigPath(root);
  const raw = fs.readFileSync(configPath, 'utf-8');
  return parseArsConfig(JSON.parse(raw) as unknown);
}

export function configExists(root = getRepoRoot()): boolean {
  return fs.existsSync(getConfigPath(root));
}

export function parseArsConfig(input: unknown): ArsConfig {
  if (!isRecord(input)) {
    throw new Error('Config root must be an object.');
  }

  const llm = expectRecord(input.llm, 'llm');
  const tts = expectRecord(input.tts, 'tts');
  const publish = expectRecord(input.publish, 'publish');
  const youtube = expectRecord(publish.youtube, 'publish.youtube');
  const extensions = expectRecord(input.extensions, 'extensions');
  const social = expectRecord(extensions.social, 'extensions.social');
  const analytics = expectRecord(extensions.analytics, 'extensions.analytics');
  const review = expectRecord(input.review, 'review');

  const defaultProvider = expectOneOf(llm.default, LLM_PROVIDER_IDS, 'llm.default');
  const fallbacks = expectStringArray(llm.fallbacks, 'llm.fallbacks').map((provider, index) =>
    expectOneOf(provider, LLM_PROVIDER_IDS, `llm.fallbacks[${index}]`),
  );

  return {
    llm: {
      default: defaultProvider,
      fallbacks,
    },
    tts: {
      provider: expectOneOf(tts.provider, TTS_PROVIDER_IDS, 'tts.provider'),
    },
    publish: {
      youtube: {
        enabled: expectBoolean(youtube.enabled, 'publish.youtube.enabled'),
        credentialsPath: expectOptionalString(
          youtube.credentialsPath,
          'publish.youtube.credentialsPath',
        ),
        clientSecretPath: expectOptionalString(
          youtube.clientSecretPath,
          'publish.youtube.clientSecretPath',
        ),
      },
    },
    extensions: {
      social: {
        enabled: expectBoolean(social.enabled, 'extensions.social.enabled'),
      },
      analytics: {
        enabled: expectBoolean(analytics.enabled, 'extensions.analytics.enabled'),
      },
    },
    review: {
      preferredUi: expectOneOf(review.preferredUi, REVIEW_UI_IDS, 'review.preferredUi'),
      enableExperimentalStudio: expectBoolean(
        review.enableExperimentalStudio,
        'review.enableExperimentalStudio',
      ),
    },
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`Config field "${field}" must be an object.`);
  }

  return value;
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Config field "${field}" must be a boolean.`);
  }

  return value;
}

function expectStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Config field "${field}" must be an array of strings.`);
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

function expectOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value as T[number])) {
    throw new Error(
      `Config field "${field}" must be one of: ${allowed.join(', ')}.`,
    );
  }

  return value as T[number];
}
