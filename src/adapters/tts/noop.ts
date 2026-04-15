import type { ITTSAdapter, TTSOptions } from '../types';

export class NoOpTTSAdapter implements ITTSAdapter {
  readonly providerId = 'none';
  readonly supportedVoices: string[] = [];

  async synthesize(_text: string, _options: TTSOptions): Promise<Buffer> {
    return Buffer.alloc(0);
  }
}
