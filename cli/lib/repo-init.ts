import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { stdin as input, stdout as output } from 'process';
import { createInterface } from 'readline/promises';
import {
  CONFIG_SCHEMA_VERSION,
  ArsConfig,
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
import { npmCommand, npmPackageCommand } from './platform-command';

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
  git: {
    available: boolean;
    initialized: boolean;
    alreadyRepo: boolean;
  };
  shellLayout: 'streaming' | 'shorts';
  ttsProvider: 'none' | 'minimax';
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
  let ttsProvider: 'none' | 'minimax' = 'none';
  const config = overwriteConfig
    ? interactive
      ? await (async () => {
          const result = await promptForConfig();
          shellLayout = result.shellLayout;
          ttsProvider = result.ttsProvider;
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
  const git = ensureGitInitialized(root);
  const versionPath = writeVersionMetadata({
    root,
    sourceRoot,
    runtimeVersion: runtime.version,
    pluginVersion: readPluginVersion(runtime.pluginRoot) ?? runtime.version,
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    installMethod: detectInstallMethod(sourceRoot),
  });

  // Run npm install when init created or materially updated the package surface.
  // Local dependency installs may leave node_modules present before init adds
  // ARS dev tooling to package.json, so also check whether required bins exist.
  const nodeModulesPath = path.join(root, 'node_modules');
  const packageJsonPath = path.join(root, 'package.json');
  let npmInstalled = false;
  if (shouldRunNpmInstall(root, packageJsonPath, nodeModulesPath, copiedFiles)) {
    const result = spawnSync(npmCommand('npm'), ['install'], {
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
    git,
    shellLayout,
    ttsProvider,
  };
}

function shouldRunNpmInstall(
  root: string,
  packageJsonPath: string,
  nodeModulesPath: string,
  copiedFiles: string[],
): boolean {
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  if (!fs.existsSync(nodeModulesPath)) {
    return true;
  }

  const packageJsonChanged = copiedFiles.some((entry) => entry.startsWith('package.json'));
  return packageJsonChanged && !hasConsumerDevTooling(root);
}

function hasConsumerDevTooling(root: string): boolean {
  const binDir = path.join(root, 'node_modules', '.bin');
  return ['eslint', 'tsc', 'vite'].every((bin) => hasNodeModulesBin(binDir, bin));
}

function hasNodeModulesBin(binDir: string, bin: string): boolean {
  return (
    fs.existsSync(path.join(binDir, bin)) ||
    (process.platform === 'win32' && fs.existsSync(path.join(binDir, `${bin}.cmd`)))
  );
}

function ensureGitInitialized(root: string): RepoInitResult['git'] {
  if (!isGitAvailable(root)) {
    return { available: false, initialized: false, alreadyRepo: false };
  }

  if (isGitRepository(root)) {
    return { available: true, initialized: false, alreadyRepo: true };
  }

  const result = spawnSync('git', ['init'], {
    cwd: root,
    stdio: 'ignore',
    shell: false,
  });

  if (result.status !== 0) {
    console.warn('[ars] git init exited with non-zero status — skipping git bootstrap');
    return { available: true, initialized: false, alreadyRepo: false };
  }

  return { available: true, initialized: true, alreadyRepo: false };
}

function isGitAvailable(root: string): boolean {
  const result = spawnSync('git', ['--version'], {
    cwd: root,
    stdio: 'ignore',
    shell: false,
  });

  return result.status === 0;
}

function isGitRepository(root: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    stdio: 'ignore',
    shell: false,
  });

  return result.status === 0;
}

function ensureRemotionSkillInstalled(root: string): boolean {
  if (process.env.ARS_SKIP_REMOTION_SKILL_INSTALL === '1') {
    return hasRemotionSkill(root);
  }

  if (hasRemotionSkill(root)) {
    return true;
  }

  const result = spawnSync(
    npmCommand('npx'),
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

export function resolveClaudeCommand(): string {
  return npmPackageCommand('claude');
}

function hasRemotionSkill(root: string): boolean {
  const skillsDir = path.join(root, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) {
    return false;
  }

  return fs.readdirSync(skillsDir).some((entry) => entry.includes('remotion'));
}

async function promptForConfig(): Promise<{
  config: ArsConfig;
  shellLayout: 'streaming' | 'shorts';
  ttsProvider: 'none' | 'minimax';
}> {
  const defaults = createDefaultConfig();
  const rl = createInterface({ input, output });

  try {
    console.log(`
ARS init will create the repo scaffold and lock in a few repo-level defaults.

These are not the branding interview. Choose the defaults if you are unsure;
/ars:onboard will tune voice, colors, assets, and SERIES_GUIDE.md after the
demo opens in Studio.
`.trim());

    console.log('\nAudio/TTS controls whether Studio shows audio tools and whether doctor checks MiniMax credentials. Choose none if you want to start with the demo first.');
    const ttsProvider = await promptChoice(
      rl,
      'TTS provider',
      ['none', 'minimax'] as const,
      'none' as const,
    );
    console.log('\nYouTube publishing controls whether prepare/publish checks are part of this repo. You can leave it off and enable it later.');
    const youtubeEnabled = await promptBooleanWithRl(
      rl,
      'Enable YouTube publishing?',
      defaults.publish.youtube.enabled,
    );
    console.log('\nChannel name is the display name written into the generated series defaults. Brand tone is tuned later in /ars:onboard.');
    const channelName = (await rl.question('Channel name (display name shown on episodes): ')).trim();
    console.log('\nLayout chooses the initial video container. streaming is for horizontal explainers; shorts is for short-form vertical output.');
    const shellLayout = await promptChoice(
      rl,
      'Layout',
      ['streaming', 'shorts'] as const,
      'streaming' as const,
    );

    const config: ArsConfig = {
      version: CONFIG_SCHEMA_VERSION,
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

    return { config, shellLayout, ttsProvider };
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
