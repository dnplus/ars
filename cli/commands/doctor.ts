import fs from 'fs';
import {
  configExists,
  getConfigPath,
  getRepoRoot,
  readArsConfig,
  type ArsConfig,
} from '../lib/ars-config';

interface CheckResult {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

const HELP = `
Usage: npx ars doctor

Validates .ars/config.json and required environment variables.
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
  validateTts(config, results);
  validatePublish(config, results);
  validateExtensions(config, results);
  validateReview(config, results);

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

function validateTts(config: ArsConfig, results: CheckResult[]): void {
  if (config.tts.provider === 'none') {
    results.push({
      label: 'tts',
      status: 'pass',
      detail: 'NoOp TTS provider enabled.',
    });
    return;
  }

  const missing = [
    !process.env.MINIMAX_API_KEY && 'MINIMAX_API_KEY',
    !process.env.MINIMAX_GROUP_ID && 'MINIMAX_GROUP_ID',
    !process.env.MINIMAX_VOICE_ID && !process.env.MINIMAX_CLONE_ID && 'MINIMAX_VOICE_ID or MINIMAX_CLONE_ID',
  ].filter(Boolean);

  results.push({
    label: 'tts',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail:
      missing.length === 0
        ? 'MiniMax credentials are configured.'
        : `MiniMax credentials missing: ${missing.join(', ')}`,
  });
}

function validatePublish(config: ArsConfig, results: CheckResult[]): void {
  if (!config.publish.youtube.enabled) {
    results.push({
      label: 'publish.youtube',
      status: 'pass',
      detail: 'YouTube publishing disabled.',
    });
    return;
  }

  const missing = [
    !process.env.YOUTUBE_CLIENT_ID && 'YOUTUBE_CLIENT_ID',
    !process.env.YOUTUBE_CLIENT_SECRET && 'YOUTUBE_CLIENT_SECRET',
    !process.env.YOUTUBE_REFRESH_TOKEN && 'YOUTUBE_REFRESH_TOKEN',
  ].filter(Boolean);

  results.push({
    label: 'publish.youtube',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail:
      missing.length === 0
        ? 'YouTube OAuth credentials are configured.'
        : `YouTube credentials missing: ${missing.join(', ')}`,
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

function validateReview(config: ArsConfig, results: CheckResult[]): void {
  const reviewDir = `${getRepoRoot()}/.ars/review-intents`;
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
