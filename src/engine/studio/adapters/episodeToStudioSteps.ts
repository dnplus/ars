/**
 * @module episodeToStudioSteps
 * @description 將 Episode 的 steps 轉換為 Studio 可導航的 step 陣列
 */

import { Episode, Step } from '../../shared/types';
import type { SubtitlePhrase } from '../../shared/subtitle';
import { StudioStepEntry } from '../types';

/**
 * 取得 Step 對應的音訊路徑
 */
function getAudioSrc(episodeId: string, stepId: string): string {
  return `episodes/${episodeId}/audio/${stepId}.mp3`;
}

/**
 * 將 Episode 轉換為 Studio step 陣列
 */
export function episodeToStudioSteps(
  episode: Episode,
  activeSeries: string,
  episodeId: string,
): StudioStepEntry[] {
  const audioBase = `${activeSeries}/${episodeId}`;
  const subtitlesByStep = episode.subtitles as Record<string, SubtitlePhrase[]> | undefined;
  return episode.steps.map((step, index) => {
    const processedStep: Step = { ...step };

    // Studio preview: summary 畫面不顯示 CTA buttons，避免干擾審稿
    if (
      processedStep.contentType === 'summary' &&
      processedStep.data &&
      typeof processedStep.data === 'object' &&
      !Array.isArray(processedStep.data)
    ) {
      processedStep.data = {
        ...processedStep.data,
        ctaButtons: [],
      };
    }

    return {
      id: step.id,
      index,
      step: processedStep,
      audioSrc: getAudioSrc(audioBase, step.id),
      subtitles: subtitlesByStep?.[step.id],
    };
  });
}

/**
 * 取得 Episode 的基本資訊（用於 studio header）
 */
export function getStudioEpisodeInfo(episode: Episode) {
  return {
    title: episode.metadata.title,
    subtitle: episode.metadata.subtitle,
    channelName: episode.metadata.channelName,
    brandTag: episode.metadata.brandTag,
    episodeTag: episode.metadata.episodeTag,
  };
}
