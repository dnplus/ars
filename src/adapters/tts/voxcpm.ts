import fs from 'fs';
import path from 'path';
import type { SpeechSpec } from '../../engine/shared/types';
import type {
  ITTSAdapter,
  TTSProviderCapabilities,
  TTSSynthesizeInput,
  TTSSynthesizeResult,
} from '../types';

const DEFAULT_MODEL_ID = 'openbmb/VoxCPM2';

export class VoxCpmTTSAdapter implements ITTSAdapter {
  readonly providerId = 'voxcpm';
  private readonly capabilities: TTSProviderCapabilities = {
    syncSynthesis: true,
    nativeTiming: false,
    pronunciationDictionary: false,
    numericProsody: false,
    voiceCloning: true,
    asyncLongForm: false,
    supportedFormats: ['wav', 'mp3'],
  };

  getCapabilities(): TTSProviderCapabilities {
    return this.capabilities;
  }

  async synthesize(input: TTSSynthesizeInput): Promise<TTSSynthesizeResult> {
    const voxcpm = input.speech.providerOptions?.voxcpm;
    const apiBase = (voxcpm?.apiBase ?? process.env.VOXCPM_API_BASE ?? '').replace(/\/+$/, '');
    if (!apiBase) {
      throw new Error('Missing VOXCPM_API_BASE (or speech.providerOptions.voxcpm.apiBase).');
    }

    const modelId = voxcpm?.modelId ?? input.speech.model ?? DEFAULT_MODEL_ID;
    const audioFormat = input.speech.format === 'mp3' ? 'mp3' : 'wav';
    const apiKey = process.env.VOXCPM_API_KEY;

    const body: Record<string, unknown> = {
      model: modelId,
      input: input.text,
      response_format: audioFormat,
      speed: input.speech.rate ?? 1,
    };

    const voice = input.speech.voice;
    if (voice) {
      body.voice = voice;
    }

    if (voxcpm?.sampleRate) {
      body.sample_rate = voxcpm.sampleRate;
    }

    const promptAudio = loadPromptAudio(voxcpm);
    if (promptAudio) {
      body.extra_body = {
        prompt_audio: promptAudio.base64,
        prompt_audio_format: promptAudio.format,
        prompt_text: promptAudio.text,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${apiBase}/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`VoxCPM request failed (${response.status}): ${await response.text()}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const durationMs = audioFormat === 'wav' ? estimateWavDurationMs(buffer) : undefined;

    return {
      providerId: this.providerId,
      modelId,
      voiceRef: voice ?? voxcpm?.promptWavPath,
      audio: buffer,
      audioFormat,
      durationMs,
      timing: undefined,
      usage: {
        characters: input.text.length,
      },
      providerMetadata: promptAudio
        ? { promptWavPath: voxcpm?.promptWavPath }
        : undefined,
    };
  }
}

type VoxCpmOptions = NonNullable<NonNullable<SpeechSpec['providerOptions']>['voxcpm']>;

function loadPromptAudio(
  voxcpm: VoxCpmOptions | undefined,
): { base64: string; format: string; text: string } | undefined {
  if (!voxcpm?.promptWavPath) {
    return undefined;
  }
  const absolute = path.isAbsolute(voxcpm.promptWavPath)
    ? voxcpm.promptWavPath
    : path.resolve(process.cwd(), voxcpm.promptWavPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`VoxCPM promptWavPath not found: ${absolute}`);
  }
  if (!voxcpm.promptText) {
    throw new Error('VoxCPM promptWavPath set without promptText. Reference text is required for zero-shot cloning.');
  }
  const ext = path.extname(absolute).slice(1).toLowerCase() || 'wav';
  return {
    base64: fs.readFileSync(absolute).toString('base64'),
    format: ext,
    text: voxcpm.promptText,
  };
}

function estimateWavDurationMs(buffer: Buffer): number | undefined {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return undefined;
  }
  const sampleRate = buffer.readUInt32LE(24);
  const byteRate = buffer.readUInt32LE(28);
  if (!sampleRate || !byteRate) {
    return undefined;
  }
  const dataBytes = buffer.length - 44;
  return Math.round((dataBytes / byteRate) * 1000);
}
