import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { stdin as input, stdout as output } from 'process';
import { createInterface } from 'readline/promises';
import {
  CONFIG_SCHEMA_VERSION,
  ArsConfig,
  TTS_PROVIDER_IDS,
  createDefaultConfig,
  getConfigPath,
  readArsConfig,
  writeArsConfig,
} from './ars-config';
import {
  detectInstallMethod,
  detectInstallState,
  getTargetRepoRoot,
  isArsDevelopmentRepo,
  locateSourcePackageRoot,
  patchClaudeMd,
  patchClaudeSettings,
  syncAgents,
  syncEngineFiles,
  syncHookScripts,
  syncSkills,
  writeVersionMetadata,
} from './install';
import { getRuntimePackageInfo } from './runtime-package';

export interface RepoInitOptions {
  force: boolean;
  forceEngine: boolean;
  forceConfig: boolean;
  forceClaudeMd: boolean;
  yes: boolean;
  quiet: boolean;
  root?: string;
}

export interface RepoInitResult {
  root: string;
  config: ArsConfig;
  configPath: string;
  copiedFiles: string[];
  claudeMdPath?: string;
  installedSkills: string[];
  versionPath: string;
  usedDefaults: boolean;
  npmInstalled: boolean;
  remotionSkillInstalled: boolean;
  shellLayout: 'streaming' | 'shorts';
}

export async function ensureRepoInitialized(options: RepoInitOptions): Promise<RepoInitResult> {
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
      `Refusing to run init inside the ARS development repo (${root}). Re-run with --force if you really want to overwrite it.`,
    );
  }

  let shellLayout: 'streaming' | 'shorts' = 'streaming';
  const config = overwriteConfig
    ? interactive
      ? await (async () => {
          const result = await promptForConfig();
          shellLayout = result.shellLayout;
          return result.config;
        })()
      : createDefaultConfig()
    : readArsConfig(root);

  const writtenConfigPath = overwriteConfig
    ? writeArsConfig(config, root)
    : configPath;
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
  syncHookScripts({
    root,
    pluginRoot: runtime.pluginRoot,
    overwrite: overwriteEverything,
  });
  patchClaudeSettings({ root, pluginRoot: runtime.pluginRoot });
  const versionPath = writeVersionMetadata({
    root,
    sourceRoot,
    runtimeVersion: runtime.version,
    pluginVersion: readPluginVersion(runtime.pluginRoot) ?? runtime.version,
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    installMethod: detectInstallMethod(sourceRoot),
  });

  // Run npm install if package.json was just generated (node_modules absent)
  const nodeModulesPath = path.join(root, 'node_modules');
  const packageJsonPath = path.join(root, 'package.json');
  let npmInstalled = false;
  if (fs.existsSync(packageJsonPath) && !fs.existsSync(nodeModulesPath)) {
    const result = spawnSync('npm', ['install'], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });
    npmInstalled = result.status === 0;
    if (result.status !== 0) {
      console.warn('[ars] npm install exited with non-zero status — check output above');
    }
  }

  const remotionSkillInstalled = ensureRemotionSkillInstalled(root);

  return {
    root,
    config,
    configPath: writtenConfigPath,
    copiedFiles,
    claudeMdPath,
    installedSkills,
    versionPath,
    usedDefaults: !interactive && overwriteConfig,
    npmInstalled,
    remotionSkillInstalled,
    shellLayout,
  };
}

function ensureRemotionSkillInstalled(root: string): boolean {
  if (hasRemotionSkill(root)) {
    return true;
  }

  const result = spawnSync(
    'npx',
    ['skills', 'add', 'remotion-dev/skills', '-a', 'claude-code', '-y'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    },
  );

  if (result.status !== 0) {
    console.warn('[ars] failed to install remotion-dev/skills into project-scoped Claude Code skills');
    return false;
  }

  return hasRemotionSkill(root);
}

function hasRemotionSkill(root: string): boolean {
  const skillsDir = path.join(root, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) {
    return false;
  }

  return fs.readdirSync(skillsDir).some((entry) => entry.includes('remotion'));
}

async function promptForConfig(): Promise<{ config: ArsConfig; shellLayout: 'streaming' | 'shorts' }> {
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
    const channelName = (await rl.question('Channel name (display name shown on episodes): ')).trim();
    const shellLayout = await promptChoice(
      rl,
      'Layout',
      ['streaming', 'shorts'] as const,
      'streaming' as const,
    );

    const config: ArsConfig = {
      version: CONFIG_SCHEMA_VERSION,
      tts: {
        provider: ttsProvider,
      },
      publish: {
        youtube: {
          enabled: youtubeEnabled,
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
        ...(channelName ? { channelName } : {}),
      },
    };

    return { config, shellLayout };
  } finally {
    rl.close();
  }
}

async function promptBooleanWithRl(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue: boolean,
): Promise<boolean> {
  const suffix = defaultValue ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${question} (${suffix}) `)).trim().toLowerCase();

  if (answer === '') {
    return defaultValue;
  }

  if (['y', 'yes'].includes(answer)) {
    return true;
  }

  if (['n', 'no'].includes(answer)) {
    return false;
  }

  console.log('Please answer yes or no.');
  return promptBooleanWithRl(rl, question, defaultValue);
}

async function promptChoice<T extends string>(
  rl: ReturnType<typeof createInterface>,
  label: string,
  choices: readonly T[],
  defaultValue: T,
): Promise<T> {
  const answer = (
    await rl.question(
      `${label} [${choices.join('/')}] (${defaultValue}) `,
    )
  ).trim();

  if (answer === '') {
    return defaultValue;
  }

  if ((choices as readonly string[]).includes(answer)) {
    return answer as T;
  }

  console.log(`Please choose one of: ${choices.join(', ')}`);
  return promptChoice(rl, label, choices, defaultValue);
}

function readPluginVersion(pluginRoot: string): string | null {
  const packageJsonPath = path.join(pluginRoot, 'package.json');
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf-8'),
    ) as { version?: unknown };
    return typeof packageJson.version === 'string' ? packageJson.version : null;
  } catch {
    return null;
  }
}
