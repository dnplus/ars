import fs from 'fs';
import path from 'path';
import process from 'process';

const VALID_LLM_DEFAULTS = new Set(['anthropic', 'openai', 'noop']);
const VALID_TTS_PROVIDERS = new Set(['none', 'minimax']);

function main() {
  const configPath = path.join(process.cwd(), '.ars', 'config.json');
  if (!fs.existsSync(configPath)) {
    console.log('ARS: .ars/config.json not found. Run /ars:setup to initialize.');
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
  const llmDefault = config?.llm?.default;
  const ttsProvider = config?.tts?.provider;
  const youtubeEnabled = config?.publish?.youtube?.enabled;

  if (!VALID_LLM_DEFAULTS.has(llmDefault)) {
    issues.push('llm.default must be one of anthropic, openai, noop');
  }

  if (!VALID_TTS_PROVIDERS.has(ttsProvider)) {
    issues.push('tts.provider must be one of none, minimax');
  }

  if (typeof youtubeEnabled !== 'boolean') {
    issues.push('publish.youtube.enabled must be a boolean');
  }

  if (issues.length > 0) {
    console.log(`ARS: Invalid .ars/config.json: ${issues.join('; ')}`);
    return;
  }

  console.log(
    `ARS: OK — llm.default=${llmDefault}, tts.provider=${ttsProvider}, publish.youtube.enabled=${String(youtubeEnabled)}`,
  );
}

main();
