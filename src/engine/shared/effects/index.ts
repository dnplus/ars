/**
 * @module shared/effects
 * @description Effects System barrel export
 *
 * @agent-note
 * 統一匯出所有效果相關的組件和工具：
 * - `CardEffect`: 通用卡片進場特效 wrapper
 * - `StepTransition`: Step 之間統一 fadeIn/fadeOut 過場
 */

export { CardEffect } from './CardEffect';
export type { StepEffect, EffectConfig } from './CardEffect';

export { StepTransition } from './StepTransition';
export type { StepTransitionProps } from './StepTransition';
