import fs from 'fs';
import path from 'path';
import { stdin as input, stdout as output } from 'process';
import { createInterface } from 'readline/promises';
import {
  CONFIG_SCHEMA_VERSION,
  ArsConfig,
  TTS_PROVIDER_IDS,
  configExists,
  createDefaultConfig,
  getConfigPath,
  readArsConfig,
  writeArsConfig,
} from '../lib/ars-config';
import {
  detectInstallMethod,
  detectInstallState,
  getTargetRepoRoot,
  isArsDevelopmentRepo,
  locateSourcePackageRoot,
  patchClaudeMd,
  syncAgents,
  syncEngineFiles,
  syncSkills,
  writeVersionMetadata,
} from '../lib/install';
import { getRuntimePackageInfo } from '../lib/runtime-package';

const HELP = `
Usage: npx ars setup [options]

Initializes .ars/config.json, copies the ARS engine into this repo, patches CLAUDE.md,
and writes .ars/.ars-version.json.

Options:
  --force              Overwrite config, engine, CLAUDE.md, and version metadata
  --force-engine       Overwrite engine files and version metadata only
  --force-config       Overwrite config.json only
  --force-claude-md    Rebuild the ARS block in CLAUDE.md
  -y, --yes            Skip interactive confirmation and use defaults
  -q, --quiet          Suppress non-error output
`;

export interface SetupOptions {
  force: boolean;
  forceEngine: boolean;
  forceConfig: boolean;
  forceClaudeMd: boolean;
  yes: boolean;
  quiet: boolean;
}

export async function run(args: string[]) {
  const options = parseOptions(args);
  const result = await setupCommand(options);

  if (options.quiet) {
    return;
  }

  if (result.configPath) {
    console.log(`✅ Wrote ${result.configPath}`);
    console.log(`   tts.provider = ${result.config.tts.provider}`);
    console.log(
      `   publish.youtube.enabled = ${String(result.config.publish.youtube.enabled)}`,
    );
    if (result.config.project.activeSeries) {
      console.log(`   project.activeSeries = ${result.config.project.activeSeries}`);
    }
  }
  if (result.copiedFiles.length > 0) {
    console.log(`✅ Synced engine into ${path.join(result.root, 'src', 'engine')}`);
    for (const copiedFile of result.copiedFiles) {
      console.log(`   ${copiedFile}`);
    }
  }
  if (result.claudeMdPath) {
    console.log(`✅ Patched ${result.claudeMdPath}`);
  }
  if (result.installedSkills.length > 0) {
    console.log(`✅ Installed ${result.installedSkills.length} ARS skills into .claude/skills/ars/`);
  }
  console.log(`✅ Wrote ${result.versionPath}`);
  if (result.usedDefaults) {
    console.log('   Non-interactive defaults were applied.');
  }
}

export async function setupCommand(options: SetupOptions & { root?: string }):
Promise<{
  root: string;
  config: ArsConfig;
  configPath?: string;
  copiedFiles: string[];
  claudeMdPath?: string;
  installedSkills: string[];
  versionPath: string;
  usedDefaults: boolean;
}> {
  const root = options.root ?? getTargetRepoRoot();
  const runtime = getRuntimePackageInfo(import.meta.url);
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  const configPath = getConfigPath(root);
  const state = detectInstallState(root);
  const interactive = !options.yes && input.isTTY && output.isTTY;
  const overwriteEverything = options.force;
  const overwriteEngine = overwriteEverything || options.forceEngine || !state.engineExists;
  const overwriteConfig = overwriteEverything || options.forceConfig || !state.configExists;
  const overwriteClaudeMd =
    overwriteEverything || options.forceClaudeMd || !state.claudeMdPatched;

  if (isArsDevelopmentRepo(root, sourceRoot) && !overwriteEverything && !options.forceEngine) {
    throw new Error(
      `Refusing to run setup inside the ARS development repo (${root}). Re-run with --force if you really want to overwrite it.`,
    );
  }

  if (
    !overwriteEverything &&
    !options.forceEngine &&
    !options.forceConfig &&
    !options.forceClaudeMd &&
    (state.configExists || state.engineExists || state.versionExists || state.claudeMdPatched)
  ) {
    if (!interactive) {
      throw new Error(
        `Existing ARS install assets were found in ${root}. Re-run with --force, --force-engine, --force-config, or --force-claude-md.`,
      );
    }

    const confirmed = await promptBoolean(
      `Existing ARS install assets were found in ${root}. Overwrite config, engine, CLAUDE.md, and version metadata?`,
      false,
    );
    if (!confirmed) {
      throw new Error('Setup cancelled.');
    }
  }

  const config = overwriteConfig
    ? interactive
      ? await promptForConfig()
      : createDefaultConfig()
    : readArsConfig(root);

  const writtenConfigPath = overwriteConfig
    ? writeArsConfig(config, root)
    : undefined;
  const copiedFiles = syncEngineFiles({
    root,
    sourceRoot,
    overwriteEngine,
    overwriteSupportFiles: overwriteEngine,
  });
  const claudeMdPath = overwriteClaudeMd ? patchClaudeMd(root) : undefined;
  const installedSkills = syncSkills({
    root,
    pluginRoot: runtime.pluginRoot,
    overwrite: overwriteEverything,
  });
  syncAgents({
    root,
    pluginRoot: runtime.pluginRoot,
    overwrite: overwriteEverything,
  });
  const versionPath = writeVersionMetadata({
    root,
    sourceRoot,
    runtimeVersion: runtime.version,
    pluginVersion: readPluginVersion(runtime.pluginRoot) ?? runtime.version,
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    installMethod: detectInstallMethod(sourceRoot),
  });

  return {
    root,
    config,
    configPath: writtenConfigPath ?? configPath,
    copiedFiles,
    claudeMdPath,
    installedSkills,
    versionPath,
    usedDefaults: !interactive && overwriteConfig,
  };
}

function parseOptions(args: string[]): SetupOptions {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  return {
    force: args.includes('--force'),
    forceEngine: args.includes('--force-engine'),
    forceConfig: args.includes('--force-config'),
    forceClaudeMd: args.includes('--force-claude-md'),
    yes: args.includes('--yes') || args.includes('-y'),
    quiet: args.includes('--quiet') || args.includes('-q'),
  };
}

async function promptForConfig(): Promise<ArsConfig> {
  const defaults = createDefaultConfig();
  const rl = createInterface({ input, output });

  try {
    const ttsProvider = await promptChoice(
      rl,
      'TTS provider',
      TTS_PROVIDER_IDS,
      defaults.tts.provider,
    );
    const youtubeEnabled = await promptBooleanWithRl(
      rl,
      'Enable YouTube publishing?',
      defaults.publish.youtube.enabled,
    );

    return {
      version: CONFIG_SCHEMA_VERSION,
      tts: {
        provider: ttsProvider,
      },
      publish: {
        youtube: {
          enabled: youtubeEnabled,
          credentialsPath: defaults.publish.youtube.credentialsPath,
          clientSecretPath: defaults.publish.youtube.clientSecretPath,
        },
      },
      extensions: {
        analytics: {
          enabled: defaults.extensions.analytics.enabled,
        },
      },
      review: {
        preferredUi: defaults.review.preferredUi,
      },
      project: {
        ...defaults.project,
      },
    };
  } finally {
    rl.close();
  }
}

async function promptBoolean(question: string, defaultValue: boolean): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    return await promptBooleanWithRl(rl, question, defaultValue);
  } finally {
    rl.close();
  }
}

async function promptBooleanWithRl(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue: boolean,
): Promise<boolean> {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${question} (${hint}) `)).trim().toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === 'y' || answer === 'yes';
}

async function promptChoice<T extends string>(
  rl: ReturnType<typeof createInterface>,
  question: string,
  choices: readonly T[],
  defaultValue: T,
): Promise<T> {
  while (true) {
    const answer = (await rl.question(
      `${question} [${choices.join('/')}] (${defaultValue}) `,
    )).trim() as T | '';

    if (!answer) {
      return defaultValue;
    }

    if (choices.includes(answer as T)) {
      return answer as T;
    }

    console.log(`Please choose one of: ${choices.join(', ')}`);
  }
}

function readPluginVersion(pluginRoot: string): string | null {
  const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8')) as {
      version?: unknown;
    };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}
