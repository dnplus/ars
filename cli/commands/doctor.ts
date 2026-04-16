import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  CONFIG_SCHEMA_VERSION,
  ArsConfig,
  configExists,
  getConfigPath,
  getRepoRoot,
  readArsConfig,
  readRawArsConfig,
} from '../lib/ars-config';
import { detectInstallState } from '../lib/install';
import { getRuntimePackageInfo } from '../lib/runtime-package';
import { hasVersionDrift, readInstalledVersion } from '../lib/version';
import { isTmuxAvailable } from '../lib/tmux';

interface CheckResult {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  fixHint?: string;
}

const HELP = `
Usage: npx ars doctor [options]

Validates .ars/config.json, engine install status, plugin assets, Claude/tmux readiness, and provider credentials.

Options:
  --json     Output machine-readable JSON
  --strict   Treat warnings as failures
`;

export async function run(args: string[]) {
  const options = parseOptions(args);
  const results = runDoctor(options);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printResults(results);
  }

  const hasFailure = results.some((result) => result.status === 'fail');
  const hasWarning = results.some((result) => result.status === 'warn');
  if (hasFailure || (options.strict && hasWarning)) {
    process.exit(1);
  }
}

export function runDoctor(options: { json: boolean; strict: boolean }): CheckResult[] {
  const root = getRepoRoot();
  const configPath = getConfigPath(root);
  const runtime = getRuntimePackageInfo(import.meta.url);
  const results: CheckResult[] = [];

  validateCliRuntime(results);

  if (!configExists(root)) {
    results.push({
      id: 'config.exists',
      status: 'fail',
      detail: `Missing ${configPath}. Run "npx ars setup" first.`,
      fixHint: 'npx ars setup --yes',
    });
    return results;
  }

  let config: ArsConfig;
  try {
    config = readArsConfig(root);
    results.push({
      id: 'config.exists',
      status: 'pass',
      detail: `Loaded ${configPath}`,
    });
  } catch (error) {
    results.push({
      id: 'config.schema',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
      fixHint: 'Re-run npx ars setup --force-config',
    });
    return results;
  }

  validateConfigSchema(root, config, results);
  validateVersion(root, runtime.version, results);
  validateEngine(root, results);
  validatePlugin(runtime.pluginRoot, results);
  validateClaudeMd(root, results);
  validateProviders(config, root, results);

  return results;
}

function parseOptions(args: string[]): { json: boolean; strict: boolean } {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  return {
    json: args.includes('--json'),
    strict: args.includes('--strict'),
  };
}

function validateCliRuntime(results: CheckResult[]): void {
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  results.push({
    id: 'cli.node-version',
    status: nodeMajor >= 22 ? 'pass' : 'fail',
    detail: `Node ${process.versions.node}`,
    fixHint: nodeMajor >= 22 ? undefined : 'Use Node 22.12.0 or newer.',
  });

  const claudeCheck = spawnSync('claude', ['--version'], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  results.push({
    id: 'cli.claude-binary',
    status: claudeCheck.status === 0 ? 'pass' : 'warn',
    detail:
      claudeCheck.status === 0
        ? `Claude CLI detected: ${claudeCheck.stdout.trim() || 'available'}`
        : 'Claude CLI not found in PATH.',
    fixHint:
      claudeCheck.status === 0 ? undefined : 'Install Claude CLI before using bare `npx ars`.',
  });

  results.push({
    id: 'cli.tmux',
    status: isTmuxAvailable() ? 'pass' : 'warn',
    detail: isTmuxAvailable()
      ? 'tmux available for session wrapping.'
      : 'tmux not available; bare `npx ars` will fall back to direct Claude launch.',
  });
}

function validateConfigSchema(
  root: string,
  config: ArsConfig,
  results: CheckResult[],
): void {
  const raw = readRawArsConfig(root) as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : null;
  results.push({
    id: 'config.schema',
    status:
      version === CONFIG_SCHEMA_VERSION
        ? 'pass'
        : version === null
          ? 'warn'
          : 'warn',
    detail:
      version === CONFIG_SCHEMA_VERSION
        ? `config version=${version}`
        : version === null
          ? `config version missing; normalized to ${config.version}`
          : `config version=${version}; latest=${CONFIG_SCHEMA_VERSION}`,
    fixHint:
      version === CONFIG_SCHEMA_VERSION ? undefined : 'Re-run npx ars setup --force-config',
  });

  const activeSeries = config.project.activeSeries?.trim();
  if (!activeSeries) {
    results.push({
      id: 'config.active-series',
      status: 'warn',
      detail: 'project.activeSeries is not set.',
      fixHint: 'Use /ars:setup for guided onboarding or run npx ars init <series>.',
    });
    return;
  }

  const seriesConfigPath = path.join(root, 'src', 'episodes', activeSeries, 'series-config.ts');
  results.push({
    id: 'config.active-series',
    status: fs.existsSync(seriesConfigPath) ? 'pass' : 'fail',
    detail: fs.existsSync(seriesConfigPath)
      ? `activeSeries=${activeSeries}`
      : `activeSeries=${activeSeries}, but ${seriesConfigPath} is missing`,
    fixHint: fs.existsSync(seriesConfigPath)
      ? undefined
      : 'Re-run npx ars init <series> or update .ars/config.json.',
  });
}

function validateVersion(
  root: string,
  runtimeVersion: string,
  results: CheckResult[],
): void {
  const installed = readInstalledVersion(root);
  if (!installed) {
    results.push({
      id: 'version.file',
      status: 'warn',
      detail: 'Missing .ars/.ars-version.json (and no legacy engine-version.json fallback found).',
      fixHint: 'Run npx ars setup or npx ars update.',
    });
    return;
  }

  results.push({
    id: 'version.file',
    status: 'pass',
    detail: `installed=${installed.version}, runtime=${runtimeVersion}`,
  });
  results.push({
    id: 'version.drift',
    status: hasVersionDrift(installed.version, runtimeVersion) ? 'warn' : 'pass',
    detail: hasVersionDrift(installed.version, runtimeVersion)
      ? `Installed version ${installed.version} differs from current CLI runtime ${runtimeVersion}.`
      : 'Installed version matches current CLI runtime.',
    fixHint: hasVersionDrift(installed.version, runtimeVersion)
      ? 'Re-run npx ars update --force-engine with the desired CLI version.'
      : undefined,
  });
}

function validateEngine(root: string, results: CheckResult[]): void {
  const state = detectInstallState(root);
  const checks = [
    {
      id: 'engine.root',
      path: path.join(root, 'src', 'engine'),
    },
    {
      id: 'engine.registry',
      path: path.join(root, 'src', 'engine', 'cards', 'registry.ts'),
    },
    {
      id: 'engine.template',
      path: path.join(root, 'src', 'episodes', 'template'),
    },
    {
      id: 'engine.composition',
      path: path.join(root, 'src', 'engine', 'Composition.tsx'),
    },
  ];

  for (const check of checks) {
    const exists = fs.existsSync(check.path);
    results.push({
      id: check.id,
      status: exists ? 'pass' : 'fail',
      detail: exists ? `Found ${check.path}` : `Missing ${check.path}`,
      fixHint: exists ? undefined : 'Run npx ars setup --force-engine',
    });
  }

  if (!state.engineExists) {
    return;
  }
}

function validatePlugin(pluginRoot: string, results: CheckResult[]): void {
  const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  const hooksPath = path.join(pluginRoot, 'hooks', 'hooks.json');
  const skillsDir = path.join(pluginRoot, 'skills');
  const skillCount = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
    : 0;

  results.push({
    id: 'plugin.manifest',
    status: fs.existsSync(manifestPath) ? 'pass' : 'fail',
    detail: fs.existsSync(manifestPath)
      ? `Found ${manifestPath}`
      : `Missing ${manifestPath}`,
  });
  results.push({
    id: 'plugin.hooks',
    status: fs.existsSync(hooksPath) ? 'pass' : 'fail',
    detail: fs.existsSync(hooksPath)
      ? `Found ${hooksPath}`
      : `Missing ${hooksPath}`,
  });
  results.push({
    id: 'plugin.skills',
    status: skillCount > 0 ? 'pass' : 'fail',
    detail:
      skillCount > 0
        ? `Found ${skillCount} plugin skill(s) in ${skillsDir}`
        : `No plugin skills found in ${skillsDir}`,
  });
}

function validateClaudeMd(root: string, results: CheckResult[]): void {
  const claudePath = path.join(root, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    results.push({
      id: 'claude-md.marker',
      status: 'warn',
      detail: `Missing ${claudePath}`,
      fixHint: 'Run npx ars setup --force-claude-md',
    });
    return;
  }

  const content = fs.readFileSync(claudePath, 'utf-8');
  const hasMarker =
    content.includes('<!-- ars:begin -->') &&
    content.includes('<!-- ars:end -->');

  results.push({
    id: 'claude-md.marker',
    status: hasMarker ? 'pass' : 'warn',
    detail: hasMarker
      ? `Found ARS marker block in ${claudePath}`
      : `ARS marker block missing from ${claudePath}`,
    fixHint: hasMarker ? undefined : 'Run npx ars setup --force-claude-md',
  });
}

function validateProviders(
  config: ArsConfig,
  root: string,
  results: CheckResult[],
): void {
  if (config.tts.provider === 'none') {
    results.push({
      id: 'provider.minimax',
      status: 'pass',
      detail: 'MiniMax TTS disabled.',
    });
  } else {
    const hasApiKey = !!process.env.MINIMAX_API_KEY;
    const hasGroupId = !!process.env.MINIMAX_GROUP_ID;
    const minimaxOk = hasApiKey && hasGroupId;
    const missing = [
      !hasApiKey && 'MINIMAX_API_KEY',
      !hasGroupId && 'MINIMAX_GROUP_ID',
    ].filter(Boolean).join(', ');
    results.push({
      id: 'provider.minimax',
      status: minimaxOk ? 'pass' : 'fail',
      detail: minimaxOk
        ? 'MiniMax credentials configured.'
        : `MiniMax enabled but missing: ${missing}.`,
      fixHint: minimaxOk
        ? undefined
        : `Add ${missing} to .env before running audio generation.`,
    });
  }

  if (!config.publish.youtube.enabled) {
    results.push({
      id: 'provider.youtube-credentials',
      status: 'pass',
      detail: 'YouTube publishing disabled.',
    });
    return;
  }

  const credentialsPath = path.resolve(
    root,
    config.publish.youtube.credentialsPath ?? '.ars/credentials/youtube/credentials.json',
  );
  const clientSecretPath = path.resolve(
    root,
    config.publish.youtube.clientSecretPath ?? '.ars/credentials/youtube/client_secret.json',
  );
  const missing = [credentialsPath, clientSecretPath].filter(
    (filePath) => !fs.existsSync(filePath),
  );

  results.push({
    id: 'provider.youtube-credentials',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail:
      missing.length === 0
        ? `Found YouTube credential files: ${credentialsPath}, ${clientSecretPath}`
        : `Missing YouTube credential files: ${missing.join(', ')}`,
    fixHint:
      missing.length === 0
        ? undefined
        : 'Create the OAuth credential files or disable publish.youtube.enabled.',
  });
}

function printResults(results: CheckResult[]): void {
  const iconMap: Record<CheckResult['status'], string> = {
    pass: '✅',
    warn: '⚠️',
    fail: '❌',
  };

  console.log('ARS doctor report');
  for (const result of results) {
    console.log(`${iconMap[result.status]} ${result.id}: ${result.detail}`);
    if (result.fixHint) {
      console.log(`   fix: ${result.fixHint}`);
    }
  }
}
