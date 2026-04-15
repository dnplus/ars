/**
 * @module scenes/index
 * @description Scene 註冊中心
 */

import { WebinarScene } from "./WebinarScene";

export type SceneType = 'webinar';  // 未來: | 'tutorial' | 'podcast'

export const SceneRegistry = {
  webinar: WebinarScene,
} as const;

export function getScene(type: SceneType) {
  return SceneRegistry[type];
}

export * from "./WebinarScene";
