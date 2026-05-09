import type { SpeechProviderId } from '../../engine/shared/types';
import type { ITTSAdapter, TTSProviderCapabilities } from '../types';
import { MiniMaxTTSAdapter } from './minimax';
import { VoxCpmTTSAdapter } from './voxcpm';

const MINIMAX_ADAPTER = new MiniMaxTTSAdapter();
const VOXCPM_ADAPTER = new VoxCpmTTSAdapter();

const ELEVENLABS_CAPABILITIES: TTSProviderCapabilities = {
  syncSynthesis: true,
  nativeTiming: false,
  pronunciationDictionary: false,
  numericProsody: false,
  voiceCloning: false,
  asyncLongForm: false,
  supportedFormats: ['mp3'],
};

export function createTTSAdapter(providerId: SpeechProviderId): ITTSAdapter {
  switch (providerId) {
    case 'minimax':
      return MINIMAX_ADAPTER;
    case 'voxcpm':
      return VOXCPM_ADAPTER;
    case 'elevenlabs':
      throw new Error('TTS provider "elevenlabs" is configured but adapter is not implemented yet.');
    default:
      return assertNever(providerId);
  }
}

export function getTTSProviderCapabilities(providerId: SpeechProviderId): TTSProviderCapabilities {
  switch (providerId) {
    case 'minimax':
      return MINIMAX_ADAPTER.getCapabilities();
    case 'voxcpm':
      return VOXCPM_ADAPTER.getCapabilities();
    case 'elevenlabs':
      return ELEVENLABS_CAPABILITIES;
    default:
      return assertNever(providerId);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported TTS provider: ${String(value)}`);
}
