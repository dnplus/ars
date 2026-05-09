import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type {
  EpisodeMetadata,
  SeriesConfig,
  SpeechSpec,
  Step,
} from '../../engine/shared/types';

export function mergeSpeechSpecs(
  ...specs: Array<SpeechSpec | undefined>
): SpeechSpec {
  return specs.reduce<SpeechSpec>((merged, spec) => {
    if (!spec) {
      return merged;
    }

    return {
      ...merged,
      ...spec,
      providerOptions: {
        minimax: {
          ...merged.providerOptions?.minimax,
          ...spec.providerOptions?.minimax,
        },
        elevenlabs: {
          ...merged.providerOptions?.elevenlabs,
          ...spec.providerOptions?.elevenlabs,
        },
        voxcpm: {
          ...merged.providerOptions?.voxcpm,
          ...spec.providerOptions?.voxcpm,
        },
      },
    };
  }, {});
}

export function resolveSpeechSpec(
  seriesSpeech: SeriesConfig['speech'],
  episodeMetadata?: EpisodeMetadata,
  step?: Step,
): SpeechSpec {
  return mergeSpeechSpecs(
    seriesSpeech.defaults,
    episodeMetadata?.speech,
    step?.speech,
  );
}

export function resolveSpeechVoice(speech: SpeechSpec): string | undefined {
  return speech.voice ?? speech.providerOptions?.elevenlabs?.voiceId;
}

export async function loadSeriesSpeechConfig(
  rootDir: string,
  series: string,
): Promise<SeriesConfig['speech'] | null> {
  const seriesConfigPath = path.join(rootDir, 'src', 'episodes', series, 'series-config.ts');
  if (!fs.existsSync(seriesConfigPath)) {
    return null;
  }

  const moduleUrl = `${pathToFileURL(seriesConfigPath).href}?mtime=${fs.statSync(seriesConfigPath).mtimeMs}`;
  const mod = await import(moduleUrl);
  const seriesConfig = mod.SERIES_CONFIG as SeriesConfig | undefined;
  return seriesConfig?.speech ?? null;
}
