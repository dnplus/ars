#!/usr/bin/env tsx
import 'dotenv/config';
import { getRuntimePackageInfo } from './lib/runtime-package';
import { launchCommand } from './commands/launch';
import { postinstallCommand } from './commands/postinstall';

type CommandModule = { run: (args: string[]) => Promise<void> };

const KNOWN_COMMANDS = new Set([
  'analytics',
  'audio',
  'auth',
  'card',
  'doctor',
  'episode',
  'export',
  'init',
  'launch',
  'postinstall',
  'prepare',
  'publish',
  'review',
  'update',
  'config',
  'upload',
  'workstate',
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
  auth <subcommand> [...]          Authorize external service credentials (e.g. YouTube OAuth)
  config <subcommand> [...]        Read or write .ars/config.json fields
  init <series-name> [options]     Bootstrap a new ARS repo and set its only active series
  update [options]                 Backup and refresh the installed ARS engine
  doctor [options]                 Validate config, engine install, plugin assets, and providers
  card <subcommand> [...]           Card catalog and metadata
  episode <subcommand> [...]       Episode management
  prepare <subcommand> [...]       Prepare release assets and metadata context
  publish <subcommand> [...]       Package and publish outputs
  audio <subcommand> [...]         Audio/TTS workflows
  review <subcommand> [...]        Review surface + review intent workflows
  export <subcommand> [...]        Export cover or subtitle artifacts
  upload <subcommand> [...]        Upload to YouTube
  workstate <subcommand> [...]     Read or write workstate stage
  analytics <subcommand> [...]     Query YouTube analytics (JSON snapshot for tooling)

Root options:
  -h, --help                       Show root help
  -V, --version                    Show ARS CLI version
`;

async function loadCommandModule(command: string): Promise<CommandModule> {
  switch (command) {
    case 'analytics':
      return import('./commands/analytics');
    case 'audio':
      return import('./commands/audio');
    case 'auth':
      return import('./commands/auth');
    case 'config':
      return import('./commands/config');
    case 'card':
      return import('./commands/card');
    case 'doctor':
      return import('./commands/doctor');
    case 'episode':
      return import('./commands/episode');
    case 'export':
      return import('./commands/export');
    case 'init':
      return import('./commands/init');
    case 'prepare':
      return import('./commands/prepare');
    case 'publish':
      return import('./commands/publish');
    case 'review':
      return import('./commands/review');
    case 'update':
      return import('./commands/update');
    case 'upload':
      return import('./commands/upload');
    case 'workstate':
      return import('./commands/workstate');
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
