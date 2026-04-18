import fs from 'fs';
import path from 'path';
import process from 'process';
import {
  buildSessionStartContext,
  getRepoRoot,
  getSeriesSpeechProvider,
  parseHookPayload,
  readStdin,
} from './lib/ars-workstate.mjs';

const CONFIG_SCHEMA_VERSION = 2;
const VALID_TTS_PROVIDERS = new Set(['minimax', 'elevenlabs']);
const VALID_VISUAL_DENSITY = new Set(['minimal', 'balanced', 'dense']);
const VALID_LAYOUT_BIAS = new Set(['mixed', 'title-card', 'card-only', 'fullscreen']);

async function main() {
  const payload = parseHookPayload(await readStdin());
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId =
    typeof payload.session_id === 'string'
      ? payload.session_id
      : typeof payload.sessionId === 'string'
        ? payload.sessionId
        : undefined;
  const root = getRepoRoot(cwd);
  const configPath = path.join(root, '.ars', 'config.json');

  if (!fs.existsSync(configPath)) {
    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: 'ARS: .ars/config.json not found. Run /ars:onboard or npx ars init <series> to initialize this repo.',
      },
    }));
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `ARS: Invalid .ars/config.json: ${message}`,
      },
    }));
    return;
  }

  const issues = [];
  const warnings = [];
  const configVersion = config?.version;
  const youtubeEnabled = config?.publish?.youtube?.enabled;
  const activeSeries = typeof config?.project?.activeSeries === 'string'
    ? config.project.activeSeries.trim()
    : '';
  const visualDensity = config?.project?.visualDensity;
  const layoutBias = config?.project?.layoutBias;

  if (typeof configVersion === 'number' && configVersion !== CONFIG_SCHEMA_VERSION) {
    warnings.push(`version=${configVersion}; latest supported schema is ${CONFIG_SCHEMA_VERSION}`);
  }

  if (typeof youtubeEnabled !== 'boolean') {
    issues.push('publish.youtube.enabled must be a boolean');
  }

  if (!activeSeries) {
    warnings.push('project.activeSeries is missing; run /ars:onboard or npx ars init <series>');
  } else {
    const seriesConfigPath = path.join(root, 'src', 'episodes', activeSeries, 'series-config.ts');
    if (!fs.existsSync(seriesConfigPath)) {
      issues.push(`project.activeSeries=${activeSeries} but ${path.relative(root, seriesConfigPath)} is missing`);
    } else {
      const speechProvider = getSeriesSpeechProvider(root, activeSeries);
      if (!speechProvider || !VALID_TTS_PROVIDERS.has(speechProvider)) {
        issues.push('series-config speech.provider must be one of minimax, elevenlabs');
      }
    }
  }

  if (visualDensity !== undefined && !VALID_VISUAL_DENSITY.has(visualDensity)) {
    issues.push('project.visualDensity must be one of minimal, balanced, dense');
  }

  if (layoutBias !== undefined && !VALID_LAYOUT_BIAS.has(layoutBias)) {
    issues.push('project.layoutBias must be one of mixed, title-card, card-only, fullscreen');
  }

  const messages = [];
  if (issues.length > 0) {
    messages.push(`ARS: Invalid .ars/config.json: ${issues.join('; ')}`);
  } else {
    if (warnings.length > 0) {
      messages.push(`ARS: Config warnings: ${warnings.join('; ')}`);
    }
    messages.push(...buildSessionStartContext(root, sessionId));
  }

  if (messages.length === 0) {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: messages.join('\n'),
    },
  }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
