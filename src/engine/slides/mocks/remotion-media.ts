/**
 * @module mocks/remotion-media
 * @description Mock @remotion/media
 */

export function getAudioData(): Promise<null> {
  return Promise.resolve(null);
}

export function useAudioData(): null {
  return null;
}

export function getAudioDurationInSeconds(): number {
  return 0;
}

export function getVideoMetadata(): Promise<{ width: number; height: number; fps: number; durationInSeconds: number }> {
  return Promise.resolve({
    width: 1920,
    height: 1080,
    fps: 30,
    durationInSeconds: 0,
  });
}
