/**
 * @module mocks/remotion-media-utils
 * @description Mock @remotion/media-utils
 */


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getAudioData(_src: string): Promise<null> {
  return Promise.resolve(null);
}

export function useAudioData(): null {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getAudioDurationInSeconds(_src: string): number {
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function visualizeAudio(_src: string): number[] {
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getVideoMetadata(_src: string): Promise<{
  width: number;
  height: number;
  fps: number;
  durationInSeconds: number;
}> {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInSeconds: 0,
  };
}
