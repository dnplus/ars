/**
 * @module episodeToSlides
 * @description 將 Episode 的 steps 轉換為 Slide 陣列
 */

import { Episode, Step } from '../../shared/types';
import { Slide, SlideType } from '../types';

/**
 * 根據 Step 的 contentType 決定 Slide 類型
 */
function getSlideType(step: Step): SlideType {
  switch (step.contentType) {
    case 'cover':
      return 'cover';
    case 'summary':
      return 'summary';
    default:
      return 'content';
  }
}

/**
 * 取得 Step 對應的音訊路徑
 */
function getAudioSrc(episodeId: string, stepId: string): string {
  return `episodes/${episodeId}/audio/${stepId}.mp3`;
}

/**
 * 將 Episode 轉換為 Slide 陣列
 */
export function episodeToSlides(episode: Episode): Slide[] {
  const resolvedId = episode.metadata.id ?? '';
  return episode.steps.map((step, index) => {
    // Clone logic for specific modifications
    const processedStep = { ...step };

    // Slides Mode: Remove CTA buttons from summary steps
    if (processedStep.contentType === 'summary') {
      processedStep.summaryCtaButtons = [];
    }

    return {
      id: step.id,
      index,
      type: getSlideType(step),
      step: processedStep,
      audioSrc: getAudioSrc(resolvedId, step.id),
    };
  });
}

/**
 * Type guard: 檢查是否為 cover step
 */
export function isCoverStep(step: Step): boolean {
  return step.contentType === 'cover';
}

/**
 * Type guard: 檢查是否為 content step（非 cover 非 summary）
 */
export function isContentStep(step: Step): boolean {
  return step.contentType !== 'cover' && step.contentType !== 'summary';
}

/**
 * Type guard: 檢查是否為 summary step
 */
export function isSummaryStep(step: Step): boolean {
  return step.contentType === 'summary';
}

/**
 * 取得 Episode 的基本資訊（用於簡報標題）
 */
export function getEpisodeInfo(episode: Episode) {
  return {
    id: episode.metadata.id,
    title: episode.metadata.title,
    subtitle: episode.metadata.subtitle,
    channelName: episode.metadata.channelName,
    decorationText: episode.metadata.decorationText,
    episodeTag: episode.metadata.episodeTag,
  };
}
