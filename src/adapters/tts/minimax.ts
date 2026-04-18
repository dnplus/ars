import path from 'path';
import fs from 'fs';
import type { SpeechSpec } from '../../engine/shared/types';
import type {
  ITTSAdapter,
  TTSProviderCapabilities,
  TTSSynthesizeInput,
  TTSSynthesizeResult,
  TTSTimingPhrase,
} from '../types';

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

interface MinimaxResponse {
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  data?: {
    audio?: string;
    subtitle_file?: string;
  };
  extra_info?: {
    audio_length?: number;
  };
}

export class MiniMaxTTSAdapter implements ITTSAdapter {
  readonly providerId = 'minimax';
  private readonly capabilities: TTSProviderCapabilities = {
    syncSynthesis: true,
    nativeTiming: true,
    pronunciationDictionary: true,
    numericProsody: true,
    voiceCloning: false,
    asyncLongForm: false,
    supportedFormats: ['mp3', 'wav', 'pcm', 'flac', 'ogg_opus'],
  };

  getCapabilities(): TTSProviderCapabilities {
    return this.capabilities;
  }

  async synthesize(input: TTSSynthesizeInput): Promise<TTSSynthesizeResult> {
    const apiKey = process.env.MINIMAX_API_KEY;
    const groupId = process.env.MINIMAX_GROUP_ID;
    const voiceId = resolveMiniMaxVoiceId(input.speech);
    const modelId = input.speech.model ?? 'speech-02-hd';
    const audioFormat = input.speech.format ?? 'mp3';
    const minimaxOptions = input.speech.providerOptions?.minimax;

    if (!apiKey || !groupId) {
      throw new Error('Missing MINIMAX_API_KEY or MINIMAX_GROUP_ID.');
    }

    if (!voiceId) {
      throw new Error('Missing MiniMax voice identifier. Set speech.voice or MINIMAX_VOICE_ID / MINIMAX_CLONE_ID.');
    }

    const pronunciationDictionary = loadPronunciationDictionary(
      minimaxOptions?.pronunciationDictPath,
      input.text,
    );

    const body: Record<string, unknown> = {
      model: modelId,
      text: input.text,
      voice_setting: {
        voice_id: voiceId,
        speed: input.speech.rate ?? 1,
        vol: input.speech.volume ?? 1,
        pitch: input.speech.pitch ?? 0,
      },
      audio_setting: {
        format: audioFormat,
        sample_rate: 32000,
      },
      subtitle_enable: input.wantTiming ?? minimaxOptions?.subtitleEnable ?? false,
    };

    if (input.speech.language) {
      body.language = input.speech.language;
    }
    if (minimaxOptions?.languageBoost) {
      body.language_boost = minimaxOptions.languageBoost;
    }
    if (minimaxOptions?.voiceModify) {
      body.voice_modify = minimaxOptions.voiceModify;
    }
    if (pronunciationDictionary.length > 0) {
      body.pronunciation_dict = {
        tone: pronunciationDictionary,
      };
    }

    const apiUrl =
      minimaxOptions?.apiBase
      ?? process.env.MINIMAX_API_URL
      ?? 'https://api-uw.minimax.io/v1/t2a_v2';
    const response = await fetch(`${apiUrl}?GroupId=${groupId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`MiniMax request failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as MinimaxResponse;
    if (data.base_resp?.status_code !== 0) {
      throw new Error(`MiniMax error: ${data.base_resp?.status_msg ?? 'unknown error'}`);
    }

    if (!data.data?.audio) {
      throw new Error('MiniMax response missing audio payload.');
    }

    const buffer = Buffer.from(data.data.audio, 'hex');
    const timing = await maybeLoadTiming(
      data.data.subtitle_file,
      input.wantTiming ?? minimaxOptions?.subtitleEnable ?? false,
    );

    return {
      providerId: this.providerId,
      modelId,
      voiceRef: voiceId,
      audio: buffer,
      audioFormat,
      durationMs: data.extra_info?.audio_length,
      timing: timing
        ? {
            source: 'provider-native',
            phrases: timing,
          }
        : undefined,
      usage: {
        characters: input.text.length,
      },
      providerMetadata: {
        subtitleFile: data.data.subtitle_file,
      },
    };
  }
}

function resolveMiniMaxVoiceId(speech: SpeechSpec): string | undefined {
  return speech.voice ?? process.env.MINIMAX_VOICE_ID ?? process.env.MINIMAX_CLONE_ID;
}

function loadPronunciationDictionary(dictPath: string | undefined, text: string): string[] {
  const yamlPath = path.resolve(process.cwd(), dictPath ?? 'cli/pronunciation_dict.yaml');
  if (!fs.existsSync(yamlPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim().startsWith('- "'))
      .map((line) => line.match(/- "(.+)"/)?.[1])
      .filter((entry): entry is string => Boolean(entry))
      .filter((entry) => {
        const word = entry.split('/')[0];
        return text.includes(word);
      });
  } catch {
    return [];
  }
}

async function maybeLoadTiming(
  subtitleFileUrl: string | undefined,
  enabled: boolean,
): Promise<TTSTimingPhrase[] | undefined> {
  if (!enabled || !subtitleFileUrl) {
    return undefined;
  }

  const subtitleResponse = await fetch(subtitleFileUrl);
  if (!subtitleResponse.ok) {
    throw new Error(`Failed to download MiniMax subtitle (${subtitleResponse.status}).`);
  }

  const subtitles = (await subtitleResponse.json()) as MinimaxSubtitleSegment[];
  return subtitles.map((segment) => ({
    text: segment.text,
    startTime: segment.time_begin / 1000,
    endTime: segment.time_end / 1000,
  }));
}
