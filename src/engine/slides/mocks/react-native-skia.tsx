/**
 * @module mocks/react-native-skia
 * @description Mock @shopify/react-native-skia for web
 *              Skia Canvas 在網頁無法使用，返回簡單的 HTML/CSS 替代
 */
import React from 'react';

// ========================================
// Canvas - 用於 SkiaReflectedTitle
// ========================================

export const Canvas: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ style, children }) => {
  return (
    <div
      className="skia-canvas-fallback"
      style={{
        ...style,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

export const Fill: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
    {children}
  </div>
);

export const Group: React.FC<{
  children?: React.ReactNode;
  transform?: Array<{ translateY?: number; translateX?: number; scale?: number }>;
  opacity?: number;
}> = ({ children, opacity = 1 }) => (
  <div
    style={{
      opacity,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </div>
);

// ========================================
// Text Component - 用 CSS 模擬 Skia Text
// ========================================

export const Text: React.FC<{
  x?: number;
  y?: number;
  text?: string;
  font?: unknown;
  children?: React.ReactNode;
}> = ({ text, children }) => (
  <div
    style={{
      fontFamily: '"Noto Sans TC", sans-serif',
      fontWeight: 700,
      fontSize: 60, // 固定像素值，會隨 transform scale 一起縮放
      color: '#c4a77d',
      textAlign: 'center',
      lineHeight: 1.3,
      textShadow: '0 2px 4px rgba(0,0,0,0.3)',
      padding: '0 20px',
      wordBreak: 'keep-all',
    }}
  >
    {text}
    {children}
  </div>
);

// ========================================
// Gradient Components
// ========================================

export const LinearGradient: React.FC<{
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  colors?: string[];
}> = () => null;

export const RadialGradient: React.FC<{
  c?: { x: number; y: number };
  r?: number;
  colors?: string[];
}> = () => null;

// ========================================
// Shader - Matrix Rain fallback
// ========================================

export const Shader: React.FC<{
  source: unknown;
  uniforms: unknown;
}> = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, transparent 0%, rgba(0, 255, 100, 0.1) 100%)',
    }}
  />
);

// ========================================
// Font Hook
// ========================================

export function useFont(src: string, size: number) {
  return {
    getGlyphIDs: (text: string) => Array.from(text).map((_, i) => i),
    getGlyphWidths: (ids: number[]) => ids.map(() => size * 0.9), // 中文字寬
    getSize: () => size,
  };
}

// ========================================
// Skia Object
// ========================================

export const Skia = {
  RuntimeEffect: {
    Make: (source: string) => ({ source }),
  },
};

export const vec = (x: number, y: number) => ({ x, y });

// No-op components
export const Image: React.FC<unknown> = () => null;
export const Rect: React.FC<unknown> = () => null;
export const Circle: React.FC<unknown> = () => null;
export const Path: React.FC<unknown> = () => null;
export const Line: React.FC<unknown> = () => null;
export const Points: React.FC<unknown> = () => null;
export const Blur: React.FC<unknown> = () => null;
export const Shadow: React.FC<unknown> = () => null;
export const ColorMatrix: React.FC<unknown> = () => null;
export const BlendColor: React.FC<unknown> = () => null;

export const LoadSkia = async () => {};

export default {
  Canvas,
  Fill,
  Group,
  Text,
  LinearGradient,
  RadialGradient,
  Shader,
  Skia,
  vec,
  useFont,
  LoadSkia,
};
