/**
 * @module mocks/remotion
 * @description Mock Remotion APIs for web slides
 *              讓原本的卡片元件可以直接在網頁中使用
 */
import React from 'react';

// ========================================
// Environment Detection Flag
// ========================================

/**
 * 設定全局標記，讓組件知道自己在 Slides 環境中
 * 因為 Vite alias 會讓所有 import 指向這個 mock，
 * 所以 try-catch 不會捕捉到任何錯誤
 */
// Studio mode: do NOT set __SLIDES_MODE__ — Player renders real Remotion animations

// ========================================
// Frame & Video Config Hooks
// ========================================

/**
 * Mock useCurrentFrame - 返回 Infinity 讓所有動畫都完成
 * 因為 interpolate 有 extrapolateRight: 'clamp'，會返回最終值
 */
export function useCurrentFrame(): number {
  return Infinity;
}

/**
 * Mock useVideoConfig - 返回標準 1080p 配置
 */
export function useVideoConfig() {
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300,
  };
}

// ========================================
// Animation Utilities
// ========================================

type ExtrapolateType = 'clamp' | 'extend' | 'identity' | 'wrap';

interface InterpolateOptions {
  extrapolateLeft?: ExtrapolateType;
  extrapolateRight?: ExtrapolateType;
  easing?: (t: number) => number;
}

/**
 * Mock interpolate - 簡化版的插值函數
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: InterpolateOptions
): number {
  const { extrapolateLeft = 'extend', extrapolateRight = 'extend' } = options || {};

  // 找到 input 在 inputRange 中的位置
  let i = 0;
  for (; i < inputRange.length - 1; i++) {
    if (input < inputRange[i + 1]) break;
  }

  // Clamp 處理
  if (input <= inputRange[0]) {
    if (extrapolateLeft === 'clamp') return outputRange[0];
  }
  if (input >= inputRange[inputRange.length - 1]) {
    if (extrapolateRight === 'clamp') return outputRange[outputRange.length - 1];
  }

  // 線性插值
  const inputMin = inputRange[i];
  const inputMax = inputRange[i + 1] ?? inputRange[i];
  const outputMin = outputRange[i];
  const outputMax = outputRange[i + 1] ?? outputRange[i];

  if (inputMax === inputMin) return outputMin;

  const t = (input - inputMin) / (inputMax - inputMin);
  return outputMin + t * (outputMax - outputMin);
}

/**
 * Mock spring - 返回目標值（動畫完成狀態）
 */
export function spring(config: {
  frame: number;
  fps: number;
  from?: number;
  to?: number;
  config?: object;
}): number {
  return config.to ?? 1;
}

// ========================================
// Media Components
// ========================================

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
};

/**
 * Mock Img - 使用原生 img 元素
 * 處理 Remotion staticFile 返回的路徑
 */
export const Img: React.FC<ImgProps> = ({ src, style, ...props }) => {
  // 檢查是否為 VTuber 圖片，加上呼吸動畫
  const isVTuber = src.includes('vtuber');


  return (
    // eslint-disable-next-line @remotion/warn-native-media-tag
    <img
      src={src}
      style={{
        ...style,
        ...(isVTuber ? { animation: 'breathing 2s ease-in-out infinite' } : {}),
      }}
      onError={(e) => {
        // 隱藏載入失敗的圖片
        (e.target as HTMLImageElement).style.display = 'none';
      }}
      {...props}
    />
  );
};

/**
 * Mock Video
 */
export const Video: React.FC<React.VideoHTMLAttributes<HTMLVideoElement>> = (props) => {
  // eslint-disable-next-line @remotion/warn-native-media-tag
  return <video {...props} />;
};

/**
 * Mock Audio
 */
export const Audio: React.FC<React.AudioHTMLAttributes<HTMLAudioElement>> = (props) => {
  // eslint-disable-next-line @remotion/warn-native-media-tag
  return <audio {...props} />;
};

/**
 * Mock staticFile - 解析靜態檔案路徑
 * 在 slides 模式下，靜態檔案位於 /public/ 目錄
 * Vite dev server 會自動 serve public 目錄下的檔案
 */
export function staticFile(path: string): string {
  // 移除開頭的斜線
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Vite 會自動從 public 目錄 serve 靜態檔案
  return `/${cleanPath}`;
}

// ========================================
// Sequence & Composition (No-ops)
// ========================================

export const Sequence: React.FC<{
  children: React.ReactNode;
  from?: number;
  durationInFrames?: number;
  name?: string;
}> = ({ children }) => <>{children}</>;

export const Series: React.FC<{ children: React.ReactNode }> & {
  Sequence: typeof Sequence;
} = Object.assign(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  { Sequence }
);

export const Composition: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

export const AbsoluteFill: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
> = ({ children, style, ...props }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

// ========================================
// Audio Utilities
// ========================================

export function getAudioData(): Promise<null> {
  return Promise.resolve(null);
}

export function useAudioData(): null {
  return null;
}

export function getAudioDurationInSeconds(): number {
  return 0;
}

// ========================================
// Other Exports
// ========================================

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  bezier: () => (t: number) => t,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function random(_seed: string | number): number {
  // eslint-disable-next-line @remotion/deterministic-randomness
  return Math.random();
}

export function delayRender(): number {
  return 0;
}

export function continueRender(): void {}

export function cancelRender(): void {}

export function registerRoot(): void {}

export function getInputProps<T>(): T {
  return {} as T;
}

// Re-export React for convenience
export { React };
