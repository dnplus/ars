import fs from 'fs';
import type { ITTSAdapter, TTSOptions } from '../types';

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
}

export class MiniMaxTTSAdapter implements ITTSAdapter {
  readonly providerId = 'minimax';
  readonly supportedVoices: string[];

  constructor(supportedVoices: string[] = []) {
    this.supportedVoices = supportedVoices;
  }

  async synthesize(text: string, options: TTSOptions): Promise<Buffer> {
    const apiKey = process.env.MINIMAX_API_KEY;
    const groupId = process.env.MINIMAX_GROUP_ID;
    const voiceId = options.voiceId ?? options.cloneId ?? process.env.MINIMAX_VOICE_ID ?? process.env.MINIMAX_CLONE_ID;

    if (!apiKey || !groupId) {
      throw new Error('Missing MINIMAX_API_KEY or MINIMAX_GROUP_ID.');
    }

    if (!voiceId) {
      throw new Error('Missing MiniMax voice identifier. Set voiceId or MINIMAX_VOICE_ID / MINIMAX_CLONE_ID.');
    }

    const body = {
      model: 'speech-02-hd',
      text,
      voice_setting: {
        voice_id: voiceId,
        speed: options.speed ?? 1,
        vol: options.volume ?? 1,
        pitch: options.pitch ?? 0,
      },
      audio_setting: {
        format: options.outputFormat ?? 'mp3',
        sample_rate: 32000,
      },
      subtitle_enable: options.enableSubtitle ?? false,
      ...(options.pronunciationDictionary && options.pronunciationDictionary.length > 0
        ? {
            pronunciation_dict: {
              tone: options.pronunciationDictionary,
            },
          }
        : {}),
    };

    const apiUrl = process.env.MINIMAX_API_URL ?? 'https://api-uw.minimax.io/v1/t2a_v2';
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

    if (options.enableSubtitle && options.subtitleOutputPath && data.data.subtitle_file) {
      const subtitleResponse = await fetch(data.data.subtitle_file);
      if (!subtitleResponse.ok) {
        throw new Error(`Failed to download MiniMax subtitle (${subtitleResponse.status}).`);
      }

      const subtitles = (await subtitleResponse.json()) as MinimaxSubtitleSegment[];
      fs.writeFileSync(options.subtitleOutputPath, `${JSON.stringify(subtitles, null, 2)}\n`, 'utf-8');
    }

    return buffer;
  }
}
