import fs from 'fs';
import { stdin as input, stdout as output } from 'process';
import { createInterface } from 'readline/promises';
import {
  configExists,
  createDefaultConfig,
  getConfigPath,
  getRepoRoot,
  type ArsConfig,
  writeArsConfig,
} from '../lib/ars-config';

const HELP = `
Usage: npx ars setup

Initializes .ars/config.json for this repo.
`;

export async function run(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const root = getRepoRoot();
  const configPath = getConfigPath(root);
  const existing = configExists(root);
  const interactive = input.isTTY && output.isTTY;

  if (existing && interactive) {
    const overwrite = await promptBoolean(
      `Config already exists at ${configPath}. Overwrite?`,
      false,
    );
    if (!overwrite) {
      console.log('Setup cancelled.');
      return;
    }
  }

  const config = interactive ? await promptForConfig() : createDefaultConfig();
  const savedPath = writeArsConfig(config, root);

  console.log(`✅ Wrote ${savedPath}`);
  console.log(`   llm.default = ${config.llm.default}`);
  console.log(`   tts.provider = ${config.tts.provider}`);
  console.log(`   publish.youtube.enabled = ${String(config.publish.youtube.enabled)}`);

  if (!interactive) {
    console.log('   Non-interactive shell detected, defaults were applied.');
  }
}

async function promptForConfig(): Promise<ArsConfig> {
  const defaults = createDefaultConfig();
  const rl = createInterface({ input, output });

  try {
    const llmDefault = await promptChoice(
      rl,
      'Default LLM provider',
      ['anthropic', 'noop'],
      defaults.llm.default,
    );
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
      llm: {
        default: llmDefault,
        fallbacks: defaults.llm.fallbacks,
      },
      tts: {
        provider: ttsProvider,
      },
      publish: {
        youtube: {
          enabled: youtubeEnabled,
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
