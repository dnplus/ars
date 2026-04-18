/**
 * @command audio
 * @description Audio generation through the configured series speech provider
 *
 * Usage:
 *   npx ars audio generate <epId> [--speed 0.5-2.0] [--no-subtitle] [--steps id1,id2,...] [--step <id>]
 */
import fs from 'fs';
import path from 'path';
import type { TTSTimingPhrase } from '../../src/adapters/types';
import { resolveSpeechSpec, loadSeriesSpeechConfig, mergeSpeechSpecs } from '../../src/adapters/tts/config';
import { createTTSAdapter } from '../../src/adapters/tts/registry';
import type { Episode, SpeechSpec } from '../../src/engine/shared/types';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';

const HELP = `
Usage: npx ars audio <subcommand> [target]

Subcommands:
  generate <epId>             Generate audio using the configured series speech provider
    --speed <0.5-2.0>         Override speech.rate for this run
    --no-subtitle             Disable subtitle generation
    --step <id>               Only generate one specific step (repeatable)
    --steps <id1,id2,...>     Only generate specific steps

Examples:
  npx ars audio generate ep005
  npx ars audio generate ep005 --speed 1.2 --steps intro,content_1
  npx ars audio generate ep005 --step intro
`;

interface SubtitlePhrase {
  text: string;
  startTime: number;
  endTime: number;
}

function loadPronunciationDict(root: string, dictPath = 'cli/pronunciation_dict.yaml'): string[] {
  const yamlPath = path.resolve(root, dictPath);
  if (!fs.existsSync(yamlPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim().startsWith('- "'))
      .map((line) => line.match(/- "(.+)"/)?.[1])
      .filter((entry): entry is string => Boolean(entry));
  } catch (error) {
    console.warn(`⚠️  Failed to parse ${path.relative(root, yamlPath)}: ${error}`);
    return [];
  }
}

function buildSubtitleFixMap(dict: string[]): Record<string, string> {
  const fixMap: Record<string, string> = {};
  for (const entry of dict) {
    const parts = entry.split('/');
    if (parts.length !== 2) {
      continue;
    }

    const [original, pronunciation] = parts;
    if (pronunciation.includes(' ') && !pronunciation.includes('(')) {
      fixMap[pronunciation] = original;
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

async function generate(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars audio generate ep005');
    process.exit(1);
  }

  const { series, epId } = resolveEpisodeTarget(target);
  const ctx = resolveSeriesContext(series);
  const seriesSpeech = await loadSeriesSpeechConfig(ctx.root, ctx.series);
  if (!seriesSpeech) {
    console.error(`❌ Missing speech config in src/episodes/${ctx.series}/series-config.ts`);
    process.exit(1);
  }

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
  let speedOverride: number | undefined;
  if (hasExplicitSpeed && args[speedIdx + 1]) {
    speedOverride = parseFloat(args[speedIdx + 1]);
    if (Number.isNaN(speedOverride) || speedOverride < 0.5 || speedOverride > 2.0) {
      console.error('❌ --speed must be between 0.5 and 2.0');
      process.exit(1);
    }
  }

  const enableSubtitle = !args.includes('--no-subtitle');

  let selectedSteps: string[] | null = null;
  const stepsIdx = args.indexOf('--steps');
  if (stepsIdx !== -1 && args[stepsIdx + 1]) {
    selectedSteps = args[stepsIdx + 1].split(',').map((step) => step.trim()).filter(Boolean);
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

  let adapter;
  try {
    adapter = createTTSAdapter(seriesSpeech.provider);
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const capabilities = adapter.getCapabilities();
  if (enableSubtitle && !capabilities.nativeTiming) {
    console.error(`❌ Provider "${seriesSpeech.provider}" does not support native timing required for subtitles.`);
    process.exit(1);
  }

  const outputDir = path.join(ctx.publicEpisodesDir, epId, 'audio');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`🎙️ ${seriesSpeech.provider} TTS (${epId})`);
  if (speedOverride != null) {
    console.log(`⚡ Override rate: ${speedOverride}x | Subtitle: ${enableSubtitle ? 'ON' : 'OFF'}`);
  } else {
    console.log(`⚡ Subtitle: ${enableSubtitle ? 'ON' : 'OFF'}`);
  }
  if (selectedSteps) {
    console.log(`🎯 Steps: ${selectedSteps.join(', ')}`);
  }

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
      steps = steps.filter((step) => step.id && selectedSteps!.includes(step.id));
    }

    console.log(`📝 ${steps.length} steps\n`);

    let success = 0;
    let fail = 0;
    const subtitles: Record<string, SubtitlePhrase[]> = {};
    const subtitleFixMaps: Record<string, Record<string, string>> = {};

    for (const step of steps) {
      if (!step.id || !step.narration) {
        continue;
      }

      const speech = mergeSpeechSpecs(
        resolveSpeechSpec(seriesSpeech, episode.metadata, step),
        speedOverride != null ? ({ rate: speedOverride } satisfies SpeechSpec) : undefined,
      );
      const dictPath = speech.providerOptions?.minimax?.pronunciationDictPath;
      subtitleFixMaps[step.id] = buildSubtitleFixMap(loadPronunciationDict(ctx.root, dictPath));

      try {
        const result = await adapter.synthesize({
          text: step.narration,
          speech,
          wantTiming: enableSubtitle,
        });

        const outputPath = path.join(outputDir, `${step.id}.${result.audioFormat}`);
        fs.writeFileSync(outputPath, result.audio);

        const segCount = result.timing?.phrases.length ?? 0;
        console.log(
          `✅ [${step.id}] ${path.basename(outputPath)} (${Math.round(result.audio.length / 1024)} KB)`
          + `${segCount > 0 ? `, ${segCount} segments` : ''}`
          + `${result.durationMs ? `, ${Math.round(result.durationMs / 1000)}s` : ''}`,
        );

        if (result.timing?.phrases.length) {
          subtitles[step.id] = result.timing.phrases;
        }
        success++;
      } catch (error) {
        fail++;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ [${step.id}] Failed: ${message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`\n✅ Success: ${success} | ❌ Failed: ${fail}`);

    if (enableSubtitle && Object.keys(subtitles).length > 0) {
      await writeSubtitleFile(ctx.episodesDir, epId, subtitles, subtitleFixMaps);
    }
  } catch (error) {
    console.error('Execution error:', error);
    process.exit(1);
  }
}

async function writeSubtitleFile(
  episodesDir: string,
  epId: string,
  newSubtitles: Record<string, TTSTimingPhrase[]>,
  subtitleFixMaps: Record<string, Record<string, string>>,
) {
  const filePath = path.join(episodesDir, `${epId}.subtitles.ts`);
  let existing: Record<string, SubtitlePhrase[]> = {};

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export const subtitles[^=]*= ({[\s\S]*});/);
      if (match) {
        existing = JSON.parse(match[1]);
      }
    } catch {
      existing = {};
    }
  }

  const fixed: Record<string, SubtitlePhrase[]> = {};
  for (const [stepId, phrases] of Object.entries(newSubtitles)) {
    const fixMap = subtitleFixMaps[stepId] ?? {};
    fixed[stepId] = phrases.map((phrase) => ({
      ...phrase,
      text: fixSubtitleText(phrase.text, fixMap),
    }));
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

export async function run(args: string[]) {
  const subcommand = args[0];
  const subArgs = args.slice(1);
  const subcommands: Record<string, (subcommandArgs: string[]) => Promise<void>> = {
    generate,
  };

  if (!subcommand || !subcommands[subcommand]) {
    console.log(HELP);
    process.exit(subcommand ? 1 : 0);
  }

  await subcommands[subcommand](subArgs);
}
