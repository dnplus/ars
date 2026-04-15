import fs from 'fs';
import path from 'path';
import { stdin as input, stdout as output } from 'process';
import { createInterface } from 'readline/promises';
import {
  configExists,
  createDefaultConfig,
  getConfigPath,
  type ArsConfig,
  writeArsConfig,
} from '../lib/ars-config';
import {
  copyDirectory,
  copyFile,
  getEngineVersionPath,
  getSourceGitCommit,
  getTargetRepoRoot,
  isArsDevelopmentRepo,
  locateSourcePackageRoot,
  patchClaudeMd,
  writeEngineVersion,
} from '../lib/install';

const HELP = `
Usage: npx ars setup [--force]

Initializes .ars/config.json, copies the ARS engine into this repo, and patches CLAUDE.md.
`;

export async function run(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const force = args.includes('--force');
  const root = getTargetRepoRoot();
  const sourceRoot = locateSourcePackageRoot(import.meta.url);
  const configPath = getConfigPath(root);
  const engineVersionPath = getEngineVersionPath(root);
  const existing = configExists(root);
  const interactive = input.isTTY && output.isTTY;
  const targetEnginePath = path.join(root, 'src', 'engine');
  const hasExistingInstall =
    existing ||
    fs.existsSync(targetEnginePath) ||
    fs.existsSync(engineVersionPath);
  let overwriteEngine = force;

  if (isArsDevelopmentRepo(root, sourceRoot) && !force) {
    console.warn(
      `⚠️ Refusing to run setup inside the ARS development repo (${root}). Re-run with --force if you really want to overwrite it.`,
    );
    return;
  }

  if (hasExistingInstall && !force) {
    if (interactive) {
      const overwrite = await promptBoolean(
        `Existing ARS install assets were found in ${root}. Overwrite config and engine files?`,
        false,
      );
      if (!overwrite) {
        console.log('Setup cancelled.');
        return;
      }
      overwriteEngine = overwrite;
    } else {
      console.error(
        `Existing ARS install assets were found in ${root}. Re-run with --force to overwrite them.`,
      );
      process.exit(1);
    }
  }

  const config = interactive ? await promptForConfig() : createDefaultConfig();
  const savedPath = writeArsConfig(config, root);
  const copiedFiles = installEngine({
    root,
    sourceRoot,
    overwriteEngine,
    force,
  });
  const claudePath = patchClaudeMd(root);
  const engineVersionRecord = {
    commit: getSourceGitCommit(sourceRoot),
    copiedAt: new Date().toISOString(),
    source: sourceRoot,
  };
  const savedEngineVersionPath = writeEngineVersion(engineVersionRecord, root);

  console.log(`✅ Wrote ${savedPath}`);
  console.log(`   tts.provider = ${config.tts.provider}`);
  console.log(`   publish.youtube.enabled = ${String(config.publish.youtube.enabled)}`);
  console.log(`✅ Copied engine to ${path.join(root, 'src', 'engine')}`);
  for (const copiedFile of copiedFiles) {
    console.log(`   ${copiedFile}`);
  }
  console.log(`✅ Patched ${claudePath}`);
  console.log(`✅ Wrote ${savedEngineVersionPath}`);

  if (!interactive) {
    console.log('   Non-interactive shell detected, defaults were applied.');
  }
}

function installEngine(options: {
  root: string;
  sourceRoot: string;
  overwriteEngine: boolean;
  force: boolean;
}): string[] {
  const copied: string[] = [];
  const sourceEngineDir = path.join(options.sourceRoot, 'src', 'engine');
  const targetEngineDir = path.join(options.root, 'src', 'engine');

  copyDirectory(sourceEngineDir, targetEngineDir, {
    overwrite: options.overwriteEngine,
  });
  copied.push(`engine/ ← ${sourceEngineDir}`);

  const sourceTemplateDir = path.join(
    options.sourceRoot,
    'src',
    'episodes',
    'template',
  );
  const targetTemplateDir = path.join(options.root, 'src', 'episodes', 'template');
  if (options.force || !fs.existsSync(targetTemplateDir)) {
    copyDirectory(sourceTemplateDir, targetTemplateDir, {
      overwrite: options.force,
    });
    copied.push(`episodes/template/ ← ${sourceTemplateDir}`);
  }

  const sourceRootFile = path.join(options.sourceRoot, 'src', 'Root.tsx');
  const targetRootFile = path.join(options.root, 'src', 'Root.tsx');
  if (options.force || !fs.existsSync(targetRootFile)) {
    copyFile(sourceRootFile, targetRootFile, { overwrite: options.force });
    copied.push(`Root.tsx ← ${sourceRootFile}`);
  }

  const sourceCompositionFile = path.join(options.sourceRoot, 'src', 'Composition.tsx');
  const targetCompositionFile = path.join(options.root, 'src', 'Composition.tsx');
  if (
    fs.existsSync(sourceCompositionFile) &&
    (options.force || !fs.existsSync(targetCompositionFile))
  ) {
    copyFile(sourceCompositionFile, targetCompositionFile, {
      overwrite: options.force,
    });
    copied.push(`Composition.tsx ← ${sourceCompositionFile}`);
  }

  return copied;
}

async function promptForConfig(): Promise<ArsConfig> {
  const defaults = createDefaultConfig();
  const rl = createInterface({ input, output });

  try {
    const ttsProvider = await promptChoice(
      rl,
      'TTS provider',
      ['none', 'minimax'],
      defaults.tts.provider,
    );
    const youtubeEnabled = await promptBooleanWithRl(
      rl,
      'Enable YouTube publishing?',
      defaults.publish.youtube.enabled,
    );
    const socialEnabled = await promptBooleanWithRl(
      rl,
      'Enable social extension flags?',
      defaults.extensions.social.enabled,
    );
    const analyticsEnabled = await promptBooleanWithRl(
      rl,
      'Enable analytics extension flags?',
      defaults.extensions.analytics.enabled,
    );
    const experimentalStudio = await promptBooleanWithRl(
      rl,
      'Enable experimental studio review UI?',
      defaults.review.enableExperimentalStudio,
    );

    return {
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
        social: {
          enabled: socialEnabled,
        },
        analytics: {
          enabled: analyticsEnabled,
        },
      },
      review: {
        preferredUi: 'slides',
        enableExperimentalStudio: experimentalStudio,
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
