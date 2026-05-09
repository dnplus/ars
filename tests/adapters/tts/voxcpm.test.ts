import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoxCpmTTSAdapter } from '../../../src/adapters/tts/voxcpm';

const tempRoots: string[] = [];
const originalCwd = process.cwd();

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function buildWavBuffer(): Buffer {
  // Minimal RIFF/WAVE header: 1ch, 16kHz, 16-bit, 16000 byte data → 0.5s.
  const dataBytes = 16000;
  const sampleRate = 16000;
  const byteRate = sampleRate * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('VoxCpmTTSAdapter', () => {
  it('throws when VOXCPM_API_BASE is missing', async () => {
    vi.stubEnv('VOXCPM_API_BASE', '');
    const adapter = new VoxCpmTTSAdapter();
    await expect(
      adapter.synthesize({ text: 'hello', speech: {} }),
    ).rejects.toThrow(/VOXCPM_API_BASE/);
  });

  it('posts an OpenAI-shape payload and decodes a WAV response', async () => {
    vi.stubEnv('VOXCPM_API_BASE', 'http://localhost:8000/v1');
    vi.stubEnv('VOXCPM_API_KEY', 'sk-test');

    const wav = buildWavBuffer();
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array(wav), { status: 200, headers: { 'Content-Type': 'audio/wav' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new VoxCpmTTSAdapter();
    const result = await adapter.synthesize({
      text: 'hello world',
      speech: { rate: 1.2, format: 'wav', voice: 'alloy' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/v1/audio/speech');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'openbmb/VoxCPM2',
      input: 'hello world',
      response_format: 'wav',
      speed: 1.2,
      voice: 'alloy',
    });
    expect(body.extra_body).toBeUndefined();

    expect(result.providerId).toBe('voxcpm');
    expect(result.audioFormat).toBe('wav');
    expect(result.audio.length).toBe(wav.length);
    expect(result.durationMs).toBe(500);
    expect(result.timing).toBeUndefined();
  });

  it('attaches prompt audio + text for zero-shot voice cloning', async () => {
    const root = makeTempRoot('ars-voxcpm-clone-');
    process.chdir(root);
    const promptPath = path.join(root, 'prompt.wav');
    fs.writeFileSync(promptPath, buildWavBuffer());

    vi.stubEnv('VOXCPM_API_BASE', 'http://localhost:8000/v1');
    vi.stubEnv('VOXCPM_API_KEY', '');
    const wav = buildWavBuffer();
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(wav), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new VoxCpmTTSAdapter();
    await adapter.synthesize({
      text: 'cloned line',
      speech: {
        providerOptions: {
          voxcpm: {
            promptWavPath: 'prompt.wav',
            promptText: 'reference transcript',
          },
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.extra_body).toMatchObject({
      prompt_audio_format: 'wav',
      prompt_text: 'reference transcript',
    });
    expect(typeof body.extra_body.prompt_audio).toBe('string');
    expect(body.extra_body.prompt_audio.length).toBeGreaterThan(0);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('rejects promptWavPath without promptText', async () => {
    const root = makeTempRoot('ars-voxcpm-missing-text-');
    process.chdir(root);
    fs.writeFileSync(path.join(root, 'prompt.wav'), buildWavBuffer());

    vi.stubEnv('VOXCPM_API_BASE', 'http://localhost:8000/v1');
    const adapter = new VoxCpmTTSAdapter();

    await expect(
      adapter.synthesize({
        text: 'hi',
        speech: {
          providerOptions: { voxcpm: { promptWavPath: 'prompt.wav' } },
        },
      }),
    ).rejects.toThrow(/promptText/);
  });
});
