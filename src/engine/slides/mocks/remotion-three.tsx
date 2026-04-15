/**
 * @module mocks/remotion-three
 * @description Mock @remotion/three for web slides.
 *              ThreeCanvas 在 slides 模式中渲染為空 div（不需要 3D）。
 */
import React from 'react';

/**
 * Mock ThreeCanvas — renders children inside a plain div.
 * In slides mode we skip actual WebGL rendering.
 */
export const ThreeCanvas: React.FC<{
  width?: number;
  height?: number;
  camera?: object;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ style }) => (
  <div style={{ position: 'relative', width: '100%', height: '100%', background: '#1a1714', ...style }} />
);
