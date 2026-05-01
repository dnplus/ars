import fs from 'fs';
import path from 'path';

export const CONFIG_SCHEMA_VERSION = 2;
export const REVIEW_UI_IDS = ['studio'] as const;
export const VISUAL_DENSITY_IDS = ['minimal', 'balanced', 'dense'] as const;
export const LAYOUT_BIAS_IDS = ['mixed', 'title-card', 'card-only', 'fullscreen'] as const;

export type ReviewUiId = (typeof REVIEW_UI_IDS)[number];
export type VisualDensityId = (typeof VISUAL_DENSITY_IDS)[number];
export type LayoutBiasId = (typeof LAYOUT_BIAS_IDS)[number];

export interface ArsConfig {
  version: number;
  publish: {
    youtube: {
      enabled: boolean;
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
    /**
     * Stamped at the end of /ars:onboard Phase 3 (customize) so a later
     * Phase 4 verify failure does not lose the brand-interview work.
     * Re-run detection treats this as "skip Phase 1/2, enter Phase 3
     * confirmation" the same way `onboardedAt` does.
     */
    customizedAt?: string;
    /**
     * Stamped only after /ars:onboard Phase 4 verify passes. Single source
     * of truth for "the full onboarding flow is complete" — read by the
     * statusline and other readiness checks.
     */
    onboardedAt?: string;
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
    publish: {
      youtube: {
        enabled: false,
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
      customizedAt: undefined,
      onboardedAt: undefined,
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
    publish: {
      youtube: {
        enabled:
          expectOptionalBoolean(youtube.enabled, 'publish.youtube.enabled') ??
          defaults.publish.youtube.enabled,
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
      customizedAt:
        expectOptionalString(project.customizedAt, 'project.customizedAt') ??
        defaults.project.customizedAt,
      onboardedAt:
        expectOptionalString(project.onboardedAt, 'project.onboardedAt') ??
        defaults.project.onboardedAt,
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
