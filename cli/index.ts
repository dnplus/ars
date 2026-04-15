#!/usr/bin/env tsx
import 'dotenv/config';
import { getRuntimePackageInfo } from './lib/runtime-package';
import { launchCommand } from './commands/launch';
import { postinstallCommand } from './commands/postinstall';

type CommandModule = { run: (args: string[]) => Promise<void> };

const KNOWN_COMMANDS = new Set([
  'audio',
  'doctor',
  'episode',
  'export',
  'init',
  'launch',
  'pipeline',
  'postinstall',
  'prepare',
  'publish',
  'review',
  'setup',
  'slides',
  'theme',
  'update',
  'upload',
]);

const HELP = `
ARS — Agentic Remotion Studio CLI

Usage:
  npx ars [claude-args...]
  npx ars <command> [options]

Launch behavior:
  bare \`ars\` launches Claude with the ARS plugin attached
  unknown top-level args are forwarded to Claude

Commands:
  launch [claude-args...]          Launch Claude with the ARS plugin attached
  setup [options]                  Initialize config, sync engine files, and patch CLAUDE.md
  update [options]                 Backup and refresh the installed ARS engine
  doctor [options]                 Validate config, engine install, plugin assets, and providers
  episode <subcommand> [...]       Episode management
  prepare <subcommand> [...]       Prepare release assets and metadata context
  publish <subcommand> [...]       Package and publish outputs
  audio <subcommand> [...]         Audio/TTS workflows
  slides <series>/<epId>           Launch the slides viewer
  review <subcommand> [...]        Review surface + review intent workflows
  init <series-name>               Initialize a new series from template
  theme <subcommand> [...]         Theme generation and preview tools
  export <subcommand> [...]        Export cover or subtitle artifacts
  upload <subcommand> [...]        Upload to YouTube
  pipeline <series>/<epId>         Run the full production pipeline

Root options:
  -h, --help                       Show root help
  -V, --version                    Show ARS CLI version
`;

async function loadCommandModule(command: string): Promise<CommandModule> {
  switch (command) {
    case 'audio':
      return import('./commands/audio');
    case 'doctor':
      return import('./commands/doctor');
    case 'episode':
      return import('./commands/episode');
    case 'export':
      return import('./commands/export');
    case 'init':
      return import('./commands/init');
    case 'pipeline':
      return import('./commands/pipeline');
    case 'prepare':
      return import('./commands/prepare');
    case 'publish':
      return import('./commands/publish');
    case 'review':
      return import('./commands/review');
    case 'setup':
      return import('./commands/setup');
    case 'slides':
      return import('./commands/slides');
    case 'theme':
      return import('./commands/theme');
    case 'update':
      return import('./commands/update');
    case 'upload':
      return import('./commands/upload');
    default:
      throw new Error(`Unknown command module: ${command}`);
  }
}

function isRootHelpRequest(args: string[]): boolean {
  return (
    args.length === 1 &&
    (args[0] === '--help' || args[0] === '-h')
  );
}

function isRootVersionRequest(args: string[]): boolean {
  return (
    args.length === 1 &&
    (args[0] === '--version' || args[0] === '-V')
  );
}

function shouldLaunch(args: string[]): boolean {
  if (args.length === 0) {
    return true;
  }

  const [firstArg] = args;
  if (KNOWN_COMMANDS.has(firstArg)) {
    return false;
  }

  if (isRootHelpRequest(args) || isRootVersionRequest(args)) {
    return false;
  }

  return true;
}

function printHelp(): void {
  console.log(HELP.trim());
}

function printVersion(): void {
  const runtime = getRuntimePackageInfo(import.meta.url);
  console.log(runtime.version);
}

async function dispatchKnownCommand(command: string, args: string[]): Promise<void> {
  if (command === 'launch') {
    await launchCommand(args);
    return;
  }

  if (command === 'postinstall') {
    await postinstallCommand();
    return;
  }

  const mod = await loadCommandModule(command);
  await mod.run(args);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (isRootHelpRequest(argv)) {
    printHelp();
    return;
  }

  if (isRootVersionRequest(argv)) {
    printVersion();
    return;
  }

  if (shouldLaunch(argv)) {
    await launchCommand(argv);
    return;
  }

  const [command, ...rest] = argv;
  await dispatchKnownCommand(command, rest);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ars] CLI error: ${message}`);
  process.exit(1);
});
