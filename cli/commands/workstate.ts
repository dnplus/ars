import fs from 'fs';
import path from 'path';
import { getRepoRoot, readArsConfig, writeArsConfig, configExists } from '../lib/ars-config';

const WORKSTATE_VERSION = 1;

const HELP = `
Usage: npx ars workstate <subcommand> [options]

Subcommands:
  get                       Print current workstate as JSON
  set --stage <s>           Write workstate with given stage
  clear                     Write workstate with active:false, stage:idle
  clear --onboarded         Same as clear, but also stamp onboardedAt
  stamp --field customized  Stamp project.customizedAt without touching workstate

Options:
  -h, --help                Show this help
`;

function getWorkstatePath(): string {
  return path.join(getRepoRoot(), '.ars', 'state', 'workstate.json');
}

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP.trim());
    return;
  }

  const [subcommand, ...rest] = args;

  if (subcommand === 'get') {
    return runGet();
  }

  if (subcommand === 'set') {
    return runSet(rest);
  }

  if (subcommand === 'clear') {
    return runClear(rest.includes('--onboarded'));
  }

  if (subcommand === 'stamp') {
    return runStamp(rest);
  }

  console.error(`Unknown workstate subcommand: ${subcommand}`);
  console.log(HELP.trim());
  process.exit(1);
}

function runGet(): void {
  const workstatePath = getWorkstatePath();

  try {
    const raw = fs.readFileSync(workstatePath, 'utf-8');
    JSON.parse(raw); // validate JSON
    console.log(raw.trim());
  } catch {
    console.log('no active workstate');
  }
}

function runSet(args: string[]): void {
  const stageIndex = args.indexOf('--stage');
  if (stageIndex === -1 || !args[stageIndex + 1]) {
    console.error('Error: --stage <stage> is required');
    process.exit(1);
  }

  const stage = args[stageIndex + 1];
  if (!stage.trim()) {
    console.error('Error: stage must be a non-empty string');
    process.exit(1);
  }

  const workstatePath = getWorkstatePath();
  fs.mkdirSync(path.dirname(workstatePath), { recursive: true });

  const workstate = {
    version: WORKSTATE_VERSION,
    active: true,
    stage,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(workstatePath, `${JSON.stringify(workstate, null, 2)}\n`, 'utf-8');
  console.log(`✅ workstate stage = ${stage}`);
}

function runClear(onboarded: boolean): void {
  const workstatePath = getWorkstatePath();
  fs.mkdirSync(path.dirname(workstatePath), { recursive: true });

  const workstate = {
    version: WORKSTATE_VERSION,
    active: false,
    stage: 'idle',
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(workstatePath, `${JSON.stringify(workstate, null, 2)}\n`, 'utf-8');
  console.log('✅ workstate cleared');

  if (onboarded && configExists()) {
    const config = readArsConfig();
    config.project.onboardedAt = new Date().toISOString();
    writeArsConfig(config);
    console.log(`✅ onboardedAt = ${config.project.onboardedAt}`);
  }
}

function runStamp(args: string[]): void {
  const fieldIndex = args.indexOf('--field');
  if (fieldIndex === -1 || !args[fieldIndex + 1]) {
    console.error('Error: --field <name> is required');
    process.exit(1);
  }

  const field = args[fieldIndex + 1];
  if (field !== 'customized') {
    console.error(`Error: unsupported stamp field "${field}". Supported: customized.`);
    process.exit(1);
  }

  if (!configExists()) {
    console.error('Error: .ars/config.json not found. Run /ars:onboard or `npx ars init <series>` first.');
    process.exit(1);
  }

  // Stamp customizedAt WITHOUT touching the workstate file. The Phase 3 →
  // Phase 4 hand-off needs the timestamp recorded immediately, but the
  // workstate stage stays on `onboard-customize` until /ars:onboard advances
  // it (typically to `onboard-verify`).
  const config = readArsConfig();
  config.project.customizedAt = new Date().toISOString();
  writeArsConfig(config);
  console.log(`✅ customizedAt = ${config.project.customizedAt}`);
}
