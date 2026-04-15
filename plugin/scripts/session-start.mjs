import fs from 'fs';
import path from 'path';
import process from 'process';

const CONFIG_SCHEMA_VERSION = 2;
const VALID_TTS_PROVIDERS = new Set(['none', 'minimax']);
const VALID_VISUAL_DENSITY = new Set(['minimal', 'balanced', 'dense']);
const VALID_LAYOUT_BIAS = new Set(['mixed', 'title-card', 'card-only', 'fullscreen']);

function main() {
  const configPath = path.join(process.cwd(), '.ars', 'config.json');
  if (!fs.existsSync(configPath)) {
    console.log('ARS: .ars/config.json not found. Run /ars:setup to initialize this repo.');
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ARS: Invalid .ars/config.json: ${message}`);
    return;
  }

  const issues = [];
  const warnings = [];
  const configVersion = config?.version;
  const ttsProvider = config?.tts?.provider;
  const youtubeEnabled = config?.publish?.youtube?.enabled;
  const activeSeries = typeof config?.project?.activeSeries === 'string'
    ? config.project.activeSeries.trim()
    : '';
  const visualDensity = config?.project?.visualDensity;
  const layoutBias = config?.project?.layoutBias;

  if (typeof configVersion !== 'number') {
    warnings.push(`version missing; expected schema ${CONFIG_SCHEMA_VERSION}`);
  } else if (configVersion !== CONFIG_SCHEMA_VERSION) {
    warnings.push(
      `version=${configVersion}; latest supported schema is ${CONFIG_SCHEMA_VERSION}`,
    );
  }

  if (!VALID_TTS_PROVIDERS.has(ttsProvider)) {
    issues.push('tts.provider must be one of none, minimax');
  }

  if (typeof youtubeEnabled !== 'boolean') {
    issues.push('publish.youtube.enabled must be a boolean');
  }

  if (!activeSeries) {
    warnings.push('project.activeSeries is missing; run /ars:setup or npx ars init <series>');
  } else {
    const seriesConfigPath = path.join(process.cwd(), 'src', 'episodes', activeSeries, 'series-config.ts');
    if (!fs.existsSync(seriesConfigPath)) {
      issues.push(`project.activeSeries=${activeSeries} but ${path.relative(process.cwd(), seriesConfigPath)} is missing`);
    }
  }

  if (visualDensity !== undefined && !VALID_VISUAL_DENSITY.has(visualDensity)) {
    issues.push('project.visualDensity must be one of minimal, balanced, dense');
  }

  if (layoutBias !== undefined && !VALID_LAYOUT_BIAS.has(layoutBias)) {
    issues.push('project.layoutBias must be one of mixed, title-card, card-only, fullscreen');
  }

  if (issues.length > 0) {
    console.log(`ARS: Invalid .ars/config.json: ${issues.join('; ')}`);
    return;
  }

  if (warnings.length > 0) {
    console.log(`ARS: Config warnings: ${warnings.join('; ')}`);
  }

  console.log(
    `ARS: OK — version=${typeof configVersion === 'number' ? configVersion : 'missing'}, activeSeries=${activeSeries || '(unset)'}, tts.provider=${ttsProvider}, publish.youtube.enabled=${String(youtubeEnabled)}`,
  );
}

main();
