#!/usr/bin/env tsx
import 'dotenv/config';
import {
  configExists,
  createDefaultConfig,
  readArsConfig,
  type ArsConfig,
} from './lib/ars-config';

/**
 * @module cli/index
 * @description ARS (Agentic Remotion Studio) CLI entry point.
 */

const HELP = `
🎬 ARS — Agentic Remotion Studio CLI

Usage:
  npx ars <command> [target] [options]

Target format:
  <series>/<epId>     e.g. template/ep-demo, template/ep-my-topic
  <series>            e.g. template  (for list commands)

Commands:
  episode create <series>/<epId>    Create a new episode (free-form epId)
  episode list <series>             List all episodes in a series
  episode validate <series>/<epId>  Validate an episode's structure
  episode stats <series>/<epId>     Card usage stats and pacing signals
  episode stats <series> --all      Aggregate card stats for a series
  episode stats --all               Aggregate card stats for all series
  prepare youtube <series>/<epId>   Prepare Claude Code context for YouTube metadata
    note                            Writes prepare-youtube.md/json, then use /ars:prepare-youtube
  prepare social <series>/<epId>    Review/apply heuristic metadata.social
    note                            Requires metadata.publish.youtubeUrl
  publish package <series>/<epId>   Export cover + SRT + render
  publish youtube <series>/<epId>   Package + upload YouTube
  publish social <series>/<epId>    Optional social extension
  publish all <series>/<epId>       Optional social extension

  audio generate <series>/<epId>    Generate audio using MiniMax TTS
    --speed <0.5-2.0>               Playback speed (default: 1.0)
    --no-subtitle                   Disable subtitle generation
    --step <id>                     Only generate one specific step (repeatable)
    --steps <id1,id2,...>           Only generate specific steps
  setup                             Initialize .ars/config.json
  doctor                            Validate .ars/config.json and provider environment
  slides <series>/<epId>            Launch web slides viewer
  review open <series>/<epId>       Launch slides review surface
  review intent <subcommand>        Manage .ars/review-intents inbox
  studio                            Launch Remotion Studio (all series)
  init <series-name>                Initialize a new series from template
  theme <subcommand> <series>       Generate, tweak, or preview a series theme
  export cover <series>/<epId>      Export cover image of an episode
  export srt <series>/<epId>        Export SRT subtitle for YouTube CC

  upload youtube <series>/<epId>    Upload video to YouTube
  upload threads <series>/<epId>    Optional social extension
  upload fbgroup <series>/<epId>    Optional social extension
  upload all <series>/<epId>        Optional social extension
    --dry-run                       Preview without uploading
    --privacy <public|unlisted|private>  YouTube privacy (default: private)
    --schedule <ISO-8601>           Schedule YouTube publish time

  pipeline <series>/<epId>          Run full pipeline: audio → render → upload
    --from <step>                   Resume from step
    --until <step>                  Stop after step
    --dry-run                       Preview uploads
    --no-interactive                Skip checkpoints

Publish notes:
  publish --dry-run                 Runs local safe steps, then simulates upload commands
  publish --force                   Rebuild cover / srt / render even if outputs already exist
  prefer publish*                   Use publish* for daily release; use low-level upload* for reruns/debugging
`;

type CommandModule = { run: (args: string[]) => Promise<void> };

function loadCliConfig(): ArsConfig {
  try {
    if (!configExists()) {
      return createDefaultConfig();
    }
    return readArsConfig();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to read .ars/config.json, using defaults: ${detail}`);
    return createDefaultConfig();
  }
}

function isSocialUploadSubcommand(args: string[]): boolean {
  return ['threads', 'fbgroup', 'all'].includes(args[0] ?? '');
}

function isSocialPublishSubcommand(args: string[]): boolean {
  return ['social', 'all'].includes(args[0] ?? '');
}

function exitExtensionDisabled(name: string, configKey: string): never {
  console.error(`Error: ${name} extension is disabled. Enable ${configKey} in .ars/config.json to use this command.`);
  process.exit(1);
}

function exitExtensionUnavailable(name: string): never {
  console.error(`Error: ${name} extension is enabled but not installed in this repo.`);
  process.exit(1);
}

async function loadCommandModule(command: string, commandArgs: string[]): Promise<CommandModule> {
  const config = loadCliConfig();

  switch (command) {
    case 'studio':
      return import('./commands/studio');
    case 'slides':
      return import('./commands/slides');
    case 'episode':
      return import('./commands/episode');
    case 'prepare':
      return import('./commands/prepare');
    case 'publish':
      if (isSocialPublishSubcommand(commandArgs) && !config.extensions.social.enabled) {
        exitExtensionDisabled('social', 'extensions.social.enabled');
      }
      return import('./commands/publish');
    case 'audio':
      return import('./commands/audio');
    case 'setup':
      return import('./commands/setup');
    case 'doctor':
      return import('./commands/doctor');
    case 'init':
      return import('./commands/init');
    case 'theme':
      return import('./commands/theme');
    case 'export':
      return import('./commands/export');
    case 'upload':
      if (isSocialUploadSubcommand(commandArgs)) {
        if (!config.extensions.social.enabled) {
          exitExtensionDisabled('social', 'extensions.social.enabled');
        }
        try {
          return await import('../extensions/social/upload-social');
        } catch {
          exitExtensionUnavailable('social');
        }
      }
      return import('./commands/upload');
    case 'pipeline':
      return import('./commands/pipeline');
    case 'review':
      return import('./commands/review');
    case 'analytics':
      if (!config.extensions.analytics.enabled) {
        exitExtensionDisabled('analytics', 'extensions.analytics.enabled');
      }
      exitExtensionUnavailable('analytics');
    default:
      console.error(`❌ Unknown command: "${command}"`);
      console.log(HELP);
      process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);

  let command: string | undefined;
  const commandArgs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(HELP);
      process.exit(0);
    }
    if (!command) {
      command = argv[i];
    } else {
      commandArgs.push(argv[i]);
    }
  }

  if (!command) {
    console.log(HELP);
    process.exit(0);
  }

  const mod = await loadCommandModule(command, commandArgs);
  await mod.run(commandArgs);
}

main().catch((err) => {
  console.error('❌ CLI error:', err);
  process.exit(1);
});
