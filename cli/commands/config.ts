import {
  getRepoRoot,
  readArsConfig,
  writeArsConfig,
  configExists,
  TTS_PROVIDER_IDS,
  VISUAL_DENSITY_IDS,
  LAYOUT_BIAS_IDS,
} from '../lib/ars-config';

const HELP = `
Usage: npx ars config <subcommand> [options]

Subcommands:
  get [key]        Print full config as JSON, or one dot-notation key
  set <key> <val>  Set a config field and write back to .ars/config.json

Allowed keys for set:
  tts.provider               none | minimax
  publish.youtube.enabled    true | false
  project.activeSeries       string
  project.channelName        string
  project.visualDirection    string
  project.tone               string
  project.visualDensity      minimal | balanced | dense
  project.layoutBias         mixed | title-card | card-only | fullscreen

Options:
  -h, --help  Show this help
`;

type AllowedKey =
  | 'tts.provider'
  | 'publish.youtube.enabled'
  | 'project.activeSeries'
  | 'project.channelName'
  | 'project.visualDirection'
  | 'project.tone'
  | 'project.visualDensity'
  | 'project.layoutBias';

const ALLOWED_KEYS: AllowedKey[] = [
  'tts.provider',
  'publish.youtube.enabled',
  'project.activeSeries',
  'project.channelName',
  'project.visualDirection',
  'project.tone',
  'project.visualDensity',
  'project.layoutBias',
];

const ENUM_VALUES: Partial<Record<AllowedKey, readonly string[]>> = {
  'tts.provider': TTS_PROVIDER_IDS,
  'publish.youtube.enabled': ['true', 'false'],
  'project.visualDensity': VISUAL_DENSITY_IDS,
  'project.layoutBias': LAYOUT_BIAS_IDS,
};

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP.trim());
    return;
  }

  const [subcommand, ...rest] = args;

  if (subcommand === 'get') {
    await runGet(rest);
    return;
  }

  if (subcommand === 'set') {
    await runSet(rest);
    return;
  }

  console.error(`Unknown config subcommand: ${subcommand}`);
  console.log(HELP.trim());
  process.exit(1);
}

async function runGet(args: string[]): Promise<void> {
  const root = getRepoRoot();

  if (!configExists(root)) {
    console.error('❌ .ars/config.json not found. Run npx ars init first.');
    process.exit(1);
  }

  const config = readArsConfig(root);

  if (args.length === 0) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const key = args[0];
  const value = resolveKey(config as unknown as Record<string, unknown>, key);

  if (value === undefined) {
    console.error(`❌ Key not found: ${key}`);
    process.exit(1);
  }

  console.log(JSON.stringify(value, null, 2));
}

async function runSet(args: string[]): Promise<void> {
  const root = getRepoRoot();

  if (!configExists(root)) {
    console.error('❌ .ars/config.json not found. Run npx ars init first.');
    process.exit(1);
  }

  if (args.length < 2) {
    console.error('Usage: npx ars config set <key> <value>');
    process.exit(1);
  }

  const [key, rawValue] = args as [string, string];

  if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
    console.error(
      `❌ Unknown config key: ${key}. Allowed keys: ${ALLOWED_KEYS.join(', ')}`,
    );
    process.exit(1);
  }

  const allowedKey = key as AllowedKey;
  const enumValues = ENUM_VALUES[allowedKey];

  if (enumValues !== undefined && !enumValues.includes(rawValue)) {
    console.error(
      `❌ Invalid value for ${key}: ${rawValue}. Must be: ${enumValues.join(', ')}`,
    );
    process.exit(1);
  }

  const parsedValue = parseValue(rawValue);
  const config = readArsConfig(root);
  setKey(config as unknown as Record<string, unknown>, allowedKey, parsedValue);
  writeArsConfig(config, root);

  console.log(`✅ config set ${key} = ${rawValue}`);
}

function resolveKey(obj: Record<string, unknown>, dotKey: string): unknown {
  const parts = dotKey.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setKey(
  obj: Record<string, unknown>,
  dotKey: string,
  value: unknown,
): void {
  const parts = dotKey.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      typeof current[part] !== 'object' ||
      current[part] === null
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function parseValue(raw: string): string | boolean | number {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!Number.isNaN(num) && raw.trim() !== '') return num;
  return raw;
}
