/**
 * @template Episode Template
 * @description Episode 範本檔案 - 由 `npx ars episode create <epId>` 自動生成
 */

import { Episode } from "../../engine/shared/types";
// import { subtitles } from "./ep999.subtitles";

export const epTemplate: Episode = {
  metadata: {
    title: 'Episode Title',
    subtitle: 'Episode Subtitle',
    episodeTag: 'EP0 · Template',

    // YouTube thumbnail — 使用 variants 陣列（YT A/B test 最多 3 個）
    // 用 `npx ars export thumbnail <epId>` 輸出 primary（預設 variants[0]）
    // 用 `npx ars export thumbnail <epId> --all-variants` 輸出全部
    // thumbnail: {
    //   variants: [
    //     {
    //       id: "v1",
    //       cardType: "thumbnail",
    //       label: "直述標題",
    //       data: {
    //         title: "你的標題",
    //         subtitle: "副標題（可選）",
    //         channelName: "頻道名稱（可選）",
    //         episodeTag: "EP01（可選）",
    //       },
    //     },
    //     {
    //       id: "v2",
    //       cardType: "thumbnail",
    //       label: "反問鉤子",
    //       data: {
    //         title: "你真的需要...？",
    //         subtitle: "副標題",
    //         channelName: "頻道名稱",
    //         episodeTag: "EP01",
    //       },
    //     },
    //   ],
    //   primary: "v1",  // 省略取 variants[0]
    // },
  },

  // shell 由 series-config.ts 自動注入，不需要手動設定
  // subtitles,

  steps: [
    {
      id: 'intro',
      contentType: 'cover',
      data: {
        animation: 'matrix',
      },
      narration: '開場旁白...',
      durationInSeconds: 10,
    },
    {
      id: 'content_1',
      contentType: 'markdown',
      title: '內容標題',
      description: '內容描述',
      data: {
        cardTitle: '卡片標題',
        cardTag: 'MARKDOWN',
        tagColor: 'blue',
        content: '卡片內容\n\n- 第一點\n- 第二點',
      },
      narration: '旁白內容...',
      durationInSeconds: 15,
    },
    {
      id: 'outro',
      contentType: 'summary',
      data: {
        title: '總結',
        points: ['重點總結'],
      },
      narration: '結尾旁白...',
      durationInSeconds: 8,
    },
  ],
};
