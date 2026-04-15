/**
 * @template Episode Template
 * @description Episode 範本檔案 - 由 `npx ars episode create <series>/<epId>` 自動生成
 */

import { Episode } from "../../engine/shared/types";
// import { subtitles } from "./ep999.subtitles";

export const epTemplate: Episode = {
  metadata: {
    title: 'Episode Title',
    subtitle: 'Episode Subtitle',
    episodeTag: 'EP0 · Template',
    // voiceId: 'male-qn-qingse',
  },

  // shell 由 series-config.ts 自動注入，不需要手動設定
  // subtitles,

  steps: [
    {
      id: 'intro',
      contentType: 'cover',
      animation: 'matrix',
      narration: '開場旁白...',
      durationInSeconds: 10,
    },
    {
      id: 'content_1',
      contentType: 'text',
      title: '內容標題',
      description: '內容描述',
      cardTitle: '卡片標題',
      cardContent: '卡片內容\n• 第一點\n• 第二點',
      narration: '旁白內容...',
      durationInSeconds: 15,
    },
    {
      id: 'outro',
      contentType: 'summary',
      title: '總結',
      description: '感謝觀看',
      summaryPoints: ['重點總結'],
      narration: '結尾旁白...',
      durationInSeconds: 8,
    },
  ],
};
