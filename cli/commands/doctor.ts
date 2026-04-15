import fs from 'fs';
import path from 'path';
import {
  configExists,
  createDefaultConfig,
  getConfigPath,
  getRepoRoot,
  readArsConfig,
  type ArsConfig,
} from '../lib/ars-config';
import { getEngineVersionPath } from '../lib/install';

interface CheckResult {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

const HELP = `
Usage: npx ars doctor

Validates .ars/config.json, engine install status, and provider credentials.
`;

export async function run(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const root = getRepoRoot();
  const configPath = getConfigPath(root);
  const results: CheckResult[] = [];

  if (!configExists(root)) {
    results.push({
      label: 'config',
      status: 'fail',
      detail: `Missing ${configPath}. Run "npx ars setup" first.`,
    });
    printResults(results);
    process.exit(1);
  }

  let config: ArsConfig;
  try {
    config = readArsConfig(root);
    results.push({
      label: 'config',
      status: 'pass',
      detail: `Loaded ${configPath}`,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({
      label: 'config',
      status: 'fail',
      detail,
    });
    printResults(results);
    process.exit(1);
    return;
  }

  validateLlm(config, results);
  validateEngine(root, results);
  validateTts(config, results);
  validatePublish(config, root, results);
  validateExtensions(config, results);
  validateReview(root, config, results);

  printResults(results);

  const hasFailure = results.some((result) => result.status === 'fail');
  if (hasFailure) {
    process.exit(1);
  }
}

function validateLlm(config: ArsConfig, results: CheckResult[]): void {
  results.push({
    label: 'llm',
    status: 'pass',
    detail: `Configured default=${config.llm.default}, fallbacks=${config.llm.fallbacks.join(', ') || 'none'}; core prepare now relies on Claude Code instead of local LLM CLIs.`,
  });
}

function validateEngine(root: string, results: CheckResult[]): void {
  const engineVersionPath = getEngineVersionPath(root);
  results.push({
    label: 'engine-version',
    status: fs.existsSync(engineVersionPath) ? 'pass' : 'warn',
    detail: fs.existsSync(engineVersionPath)
      ? `Loaded ${engineVersionPath}`
      : `Missing ${engineVersionPath}. Run "npx ars setup" or "npx ars update" to record the installed engine version.`,
  });

  const registryPath = path.join(root, 'src', 'engine', 'cards', 'registry.ts');
  results.push({
    label: 'engine.registry',
    status: fs.existsSync(registryPath) ? 'pass' : 'fail',
    detail: fs.existsSync(registryPath)
      ? `Found ${registryPath}`
      : `Missing ${registryPath}. Reinstall the engine with "npx ars setup --force" or "npx ars update".`,
  });
}

function validateTts(config: ArsConfig, results: CheckResult[]): void {
  if (config.tts.provider === 'none') {
    results.push({
      label: 'tts',
      status: 'pass',
      detail: 'NoOp TTS provider enabled.',
    });
    return;
  }

  results.push({
    label: 'tts',
    status: process.env.MINIMAX_API_KEY ? 'pass' : 'fail',
    detail: process.env.MINIMAX_API_KEY
      ? 'MiniMax API key is configured.'
      : 'MiniMax enabled but MINIMAX_API_KEY is missing.',
  });
}

function validatePublish(
  config: ArsConfig,
  root: string,
  results: CheckResult[],
): void {
  if (!config.publish.youtube.enabled) {
    results.push({
      label: 'publish.youtube',
      status: 'pass',
      detail: 'YouTube publishing disabled.',
    });
    return;
  }

  const defaults = createDefaultConfig();
  const credentialsPath = path.resolve(
    root,
    config.publish.youtube.credentialsPath ??
      defaults.publish.youtube.credentialsPath ??
      '.ars/credentials/youtube/credentials.json',
  );
  const clientSecretPath = path.resolve(
    root,
    config.publish.youtube.clientSecretPath ??
      defaults.publish.youtube.clientSecretPath ??
      '.ars/credentials/youtube/client_secret.json',
  );
  const missing = [
    !fs.existsSync(credentialsPath) && credentialsPath,
    !fs.existsSync(clientSecretPath) && clientSecretPath,
  ].filter(Boolean) as string[];

  results.push({
    label: 'publish.youtube',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail:
      missing.length === 0
        ? `YouTube OAuth files found: ${credentialsPath}, ${clientSecretPath}`
        : `YouTube OAuth files missing: ${missing.join(', ')}`,
  });
}

function validateExtensions(config: ArsConfig, results: CheckResult[]): void {
  const enabled = [
    config.extensions.social.enabled && 'social',
    config.extensions.analytics.enabled && 'analytics',
  ].filter(Boolean);

  results.push({
    label: 'extensions',
    status: enabled.length === 0 ? 'pass' : 'warn',
    detail:
      enabled.length === 0
        ? 'All optional extensions are disabled.'
        : `Optional extensions enabled: ${enabled.join(', ')}`,
  });
}

function validateReview(
  root: string,
  config: ArsConfig,
  results: CheckResult[],
): void {
  const reviewDir = `${root}/.ars/review-intents`;
  results.push({
    label: 'review',
    status: 'pass',
    detail: `preferredUi=${config.review.preferredUi}, experimentalStudio=${String(config.review.enableExperimentalStudio)}, inbox=${reviewDir}`,
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
    console.log(`${iconMap[result.status]} ${result.label}: ${result.detail}`);
  }
}
