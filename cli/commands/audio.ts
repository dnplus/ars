/**
 * @command audio
 * @description Audio generation using MiniMax TTS
 *
 * Usage:
 *   npx ars audio generate <epId> [--speed 0.5-2.0] [--no-subtitle] [--steps id1,id2,...] [--step <id>]
 */
import path from 'path';
import fs from 'fs';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';
import type { Episode, SeriesConfig } from '../../src/engine/shared/types';

const HELP = `
Usage: npx ars audio <subcommand> [target]

Subcommands:
  generate <epId>             Generate audio using MiniMax TTS in the active series
    --speed <0.5-2.0>         Playback speed (default: 1.0)
    --no-subtitle             Disable subtitle generation
    --step <id>               Only generate one specific step (repeatable)
    --steps <id1,id2,...>     Only generate specific steps

Examples:
  npx ars audio generate ep005
  npx ars audio generate ep005 --speed 1.2 --steps intro,content_1
  npx ars audio generate ep005 --step intro
`;

// MiniMax API types
interface MinimaxSubtitleSegment {
  text: string;
  pronounce_text: string;
  time_begin: number;
  time_end: number;
  text_begin: number;
  text_end: number;
  pronounce_text_begin: number;
  pronounce_text_end: number;
  timestamped_words: null;
}

interface SubtitlePhrase {
  text: string;
  startTime: number;
  endTime: number;
}

// ── Pronunciation dictionary ────────────────────────────
function loadPronunciationDict(root: string): string[] {
  // Unified path: cli/pronunciation_dict.yaml
  const yamlPath = path.join(root, 'cli/pronunciation_dict.yaml');

  if (fs.existsSync(yamlPath)) {
    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim().startsWith('- "'))
        .map(line => line.match(/- "(.+)"/)?.[1])
        .filter(Boolean) as string[];
    } catch (error) {
      console.warn(`⚠️  Failed to parse pronunciation_dict.yaml: ${error}`);
      return [];
    }
  }

  console.warn('⚠️  pronunciation_dict.yaml not found, using empty dict');
  return [];
}

function getRelevantPronunciation(text: string, dict: string[]): string[] {
  return dict.filter(entry => {
    const word = entry.split('/')[0];
    return text.includes(word);
  });
}

function buildSubtitleFixMap(dict: string[]): Record<string, string> {
  const fixMap: Record<string, string> = {};
  for (const entry of dict) {
    const parts = entry.split('/');
    if (parts.length === 2) {
      const original = parts[0];
      const pronunciation = parts[1];
      if (pronunciation.includes(' ') && !pronunciation.includes('(')) {
        fixMap[pronunciation] = original;
      }
    }
  }
  return fixMap;
}

function fixSubtitleText(text: string, fixMap: Record<string, string>): string {
  let fixed = text;
  for (const [wrong, correct] of Object.entries(fixMap)) {
    fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
  }
  return fixed;
}

// ── TTS API call ────────────────────────────────────────
async function callTTS(
  text: string,
  outputPath: string,
  stepId: string,
  options: {
    speed: number;
    enableSubtitle: boolean;
    dict: string[];
    voiceId?: string; // step.voiceId || episode.metadata.voiceId
    pitch?: number;      // voice_setting.pitch (-12~12)
  },
): Promise<{ success: boolean; subtitle?: MinimaxSubtitleSegment[]; duration?: number }> {
  const API_KEY = process.env.MINIMAX_API_KEY;
  const GROUP_ID = process.env.MINIMAX_GROUP_ID;
  // 使用 UW region API (stash 中的修改)
  const API_BASE = 'https://api-uw.minimax.io';

  // Voice ID 回退順序：
  // 1. step.voiceId / episode.metadata.voiceId（從 options 傳入）
  // 2. 環境變數 MINIMAX_VOICE_ID
  // 找不到就報錯
  const VOICE_ID = options.voiceId || process.env.MINIMAX_VOICE_ID;
  if (!VOICE_ID) {
    throw new Error(
      `❌ No voice ID found for step "${stepId}".\n` +
      `   Set episode.metadata.voiceId, step.voiceId, or env MINIMAX_VOICE_ID.`
    );
  }

  const url = `${API_BASE}/v1/t2a_v2?GroupId=${GROUP_ID}`;
  const toneEntries = getRelevantPronunciation(text, options.dict);

  const body: Record<string, unknown> = {
    model: 'speech-02-hd',
    text,
    voice_setting: { voice_id: VOICE_ID, speed: options.speed, vol: 1.0, pitch: options.pitch ?? 0 },
    audio_setting: { format: 'mp3', sample_rate: 32000 },
    subtitle_enable: options.enableSubtitle,
  };

  if (toneEntries.length > 0) {
    body.pronunciation_dict = { tone: toneEntries };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`API error (${res.status}): ${await res.text()}`);

    const data = await res.json();
    if (data.base_resp?.status_code !== 0) throw new Error(`MiniMax error: ${data.base_resp?.status_msg}`);

    const audioHex = data.data?.audio;
    if (!audioHex) throw new Error('No audio data in response');

    const audioBuffer = Buffer.from(audioHex, 'hex');
    fs.writeFileSync(outputPath, audioBuffer);

    let subtitleData: MinimaxSubtitleSegment[] | undefined;
    if (options.enableSubtitle && data.data?.subtitle_file) {
      try {
        const subRes = await fetch(data.data.subtitle_file);
        subtitleData = await subRes.json();
      } catch { /* subtitle download failed */ }
    }

    const duration = data.extra_info?.audio_length ? data.extra_info.audio_length / 1000 : undefined;
    const segCount = subtitleData?.length || 0;
    console.log(`✅ [${stepId}] ${path.basename(outputPath)} (${Math.round(audioBuffer.length / 1024)} KB)${segCount > 0 ? `, ${segCount} segments` : ''}${duration ? `, ${Math.round(duration)}s` : ''}`);

    return { success: true, subtitle: subtitleData, duration };
  } catch (error: any) {
    console.error(`❌ [${stepId}] Failed: ${error.message}`);
    return { success: false };
  }
}

// ── generate ────────────────────────────────────────────
async function generate(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars audio generate ep005');
    process.exit(1);
  }

  const { series, epId } = resolveEpisodeTarget(target, path.resolve(__dirname, '../..'));
  const ctx = resolveSeriesContext(series);

  if (!process.env.MINIMAX_API_KEY || !process.env.MINIMAX_GROUP_ID) {
    console.error('❌ Missing MINIMAX_API_KEY or MINIMAX_GROUP_ID in .env');
    process.exit(1);
  }

  // Parse options
  const knownFlags = new Set(['--speed', '--no-subtitle', '--steps', '--step']);
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    if (!knownFlags.has(arg)) {
      console.error(`❌ Unknown option: ${arg}`);
      console.log('Usage: npx ars audio generate ep005 --steps intro,content_1');
      console.log('   or: npx ars audio generate ep005 --step intro');
      process.exit(1);
    }
    if ((arg === '--speed' || arg === '--steps' || arg === '--step') && !args[i + 1]) {
      console.error(`❌ Missing value for ${arg}`);
      process.exit(1);
    }
  }

  const speedIdx = args.indexOf('--speed');
  const hasExplicitSpeed = speedIdx !== -1 && !!args[speedIdx + 1];
  let speed = 1.0;
  if (hasExplicitSpeed && args[speedIdx + 1]) {
    speed = parseFloat(args[speedIdx + 1]);
    if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
      console.error('❌ --speed must be between 0.5 and 2.0');
      process.exit(1);
    }
  }

  const enableSubtitle = !args.includes('--no-subtitle');

  let selectedSteps: string[] | null = null;
  const stepsIdx = args.indexOf('--steps');
  if (stepsIdx !== -1 && args[stepsIdx + 1]) {
    selectedSteps = args[stepsIdx + 1].split(',').map(s => s.trim()).filter(Boolean);
  }
  const singleStepArgs: string[] = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--step' && args[i + 1]) {
      singleStepArgs.push(args[i + 1].trim());
      i++;
    }
  }
  if (singleStepArgs.length > 0) {
    selectedSteps = [...new Set([...(selectedSteps ?? []), ...singleStepArgs])];
  }

  const epFilePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (!fs.existsSync(epFilePath)) {
    console.error(`❌ Episode not found: ${epFilePath}`);
    process.exit(1);
  }

  const dict = loadPronunciationDict(ctx.root);
  const outputDir = path.join(ctx.publicEpisodesDir, epId, 'audio');
  fs.mkdirSync(outputDir, { recursive: true });

  // 載入 series-config 取得 TTS 微調設定
  let ttsConfig: SeriesConfig['tts'] | undefined;
  let seriesDefaultVoiceId: string | undefined;
  const seriesConfigPath = path.join(ctx.episodesDir, 'series-config.ts');
  if (fs.existsSync(seriesConfigPath)) {
    try {
      const scMod = await import(seriesConfigPath);
      const sc: SeriesConfig = scMod.SERIES_CONFIG;
      ttsConfig = sc?.tts;
      seriesDefaultVoiceId = sc?.episodeDefaults?.voiceId;
      if (!hasExplicitSpeed && sc?.tts?.speed != null) {
        speed = sc.tts.speed;
      }
    } catch { /* series-config 載入失敗不影響主流程 */ }
  }

  console.log(`🎙️ MiniMax TTS (${epId})`);
  console.log(`⚡ Speed: ${speed}x | Dict: ${dict.length} entries | Subtitle: ${enableSubtitle ? 'ON' : 'OFF'}`);
  if (ttsConfig?.pitch != null) {
    console.log(`🎵 Voice: pitch:${ttsConfig.pitch}`);
  }
  if (selectedSteps) console.log(`🎯 Steps: ${selectedSteps.join(', ')}`);

  try {
    const mod = await import(epFilePath);
    const camelId = epId.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    const episode: Episode = mod[camelId] || mod[epId] || mod.default;
    if (!episode) {
      console.error(`❌ No recognizable export found in ${epFilePath}`);
      process.exit(1);
    }

    let steps = episode.steps;
    if (selectedSteps) {
      steps = steps.filter(s => s.id && selectedSteps!.includes(s.id));
    }

    console.log(`📝 ${steps.length} steps\n`);

    let success = 0, fail = 0;
    const subtitles: Record<string, SubtitlePhrase[]> = {};

    // voiceId 回退順序：step.voiceId > episode.metadata.voiceId > series-config episodeDefaults.voiceId > env
    const episodeVoiceId = episode.metadata.voiceId;

    for (const step of steps) {
      if (!step.id || !step.narration) continue;

      const outputPath = path.join(outputDir, `${step.id}.mp3`);
      const result = await callTTS(step.narration, outputPath, step.id, {
        speed: step.speed ?? speed,
        enableSubtitle,
        dict,
        voiceId: step.voiceId || episodeVoiceId || seriesDefaultVoiceId, // step 層級優先
        pitch: step.pitch ?? ttsConfig?.pitch,
      });

      if (result.success) {
        success++;
        if (result.subtitle?.length) {
          subtitles[step.id] = result.subtitle.map(seg => ({
            text: seg.text,
            startTime: seg.time_begin / 1000,
            endTime: seg.time_end / 1000,
          }));
        }
      } else {
        fail++;
      }

      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n✅ Success: ${success} | ❌ Failed: ${fail}`);

    // Generate subtitle file
    if (enableSubtitle && Object.keys(subtitles).length > 0) {
      await writeSubtitleFile(ctx.episodesDir, epId, subtitles, dict);
    }
  } catch (e: any) {
    console.error('Execution error:', e);
    process.exit(1);
  }
}

async function writeSubtitleFile(
  episodesDir: string,
  epId: string,
  newSubtitles: Record<string, SubtitlePhrase[]>,
  dict: string[],
) {
  const filePath = path.join(episodesDir, `${epId}.subtitles.ts`);
  let existing: Record<string, SubtitlePhrase[]> = {};

  // Read existing subtitles
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export const subtitles[^=]*= ({[\s\S]*});/);
      if (match) existing = JSON.parse(match[1]);
    } catch { /* parse failed, overwrite */ }
  }

  // Fix text and merge
  const fixMap = buildSubtitleFixMap(dict);
  const fixed: Record<string, SubtitlePhrase[]> = {};
  for (const [stepId, phrases] of Object.entries(newSubtitles)) {
    fixed[stepId] = phrases.map(p => ({ ...p, text: fixSubtitleText(p.text, fixMap) }));
  }

  const merged = { ...existing, ...fixed };

  const content = `/**
 * @generated by ars audio generate
 * @episode ${epId}
 */

import { type SubtitlePhrase } from "../../engine/shared/subtitle";

export const subtitles: Record<string, SubtitlePhrase[]> = ${JSON.stringify(merged, null, 2)};
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Subtitles: ${path.basename(filePath)} (${Object.keys(merged).length} steps)`);
}

// ── router ──────────────────────────────────────────────
export async function run(args: string[]) {
  const sub = args[0];
  const subArgs = args.slice(1);

  const subs: Record<string, (a: string[]) => Promise<void>> = { generate };

  if (!sub || !subs[sub]) {
    console.log(HELP);
    process.exit(sub ? 1 : 0);
  }

  await subs[sub](subArgs);
}
