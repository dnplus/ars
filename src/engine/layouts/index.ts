/**
 * @module layouts/index
 * @description Layout 註冊中心
 */

import { StreamingLayout, StreamingLayoutConfig } from "./StreamingLayout";
import { ShortsLayout } from "./ShortsLayout";

export type LayoutType = 'streaming' | 'shorts';

export type LayoutConfig = 
  | { type: 'streaming'; config: StreamingLayoutConfig }
  | { type: 'shorts'; config: StreamingLayoutConfig };

export const LayoutRegistry = {
  streaming: StreamingLayout,
  shorts: ShortsLayout,
} as const;

export function getLayout(type: LayoutType) {
  return LayoutRegistry[type];
}

export * from "./StreamingLayout";
