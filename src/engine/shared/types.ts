/**
 * @module shared/types
 * @description Global Type Definitions / Data Schema
 *
 * @agent-note
 * This is the **Source of Truth** for the "Content as Code" schema.
 * - `Episode`: Root structure map to a video.
 * - `Step`: The polymorphic unit of content. Check `contentType` to discriminate.
 *   - Primary: `cover|ticker|summary|markdown|code|image|mermaid`
 *   - Custom: globally unique card type string (e.g. `normal-distribution`)
 *   - Legacy alias: `text`
 *
 * @architectural-role Dictionary
 * Used by: `src/episodes/*.ts`, `src/Composition.tsx`, `scripts/*.ts`
 */

import type { LayoutReference } from "../layouts";
import type { StreamingLayoutConfig } from "../layouts/StreamingLayout";
import type { StepEffect, EffectConfig } from "./effects/CardEffect";
import type { Theme } from "./theme";

export type SpeechProviderId = "minimax" | "elevenlabs";

export type SpeechAudioFormat = "mp3" | "wav" | "pcm" | "flac" | "ogg_opus";

export type SpeechSpec = {
  model?: string;
  voice?: string;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  format?: SpeechAudioFormat;
  providerOptions?: {
    minimax?: {
      languageBoost?: string;
      subtitleEnable?: boolean;
      pronunciationDictPath?: string;
      apiBase?: string;
      voiceModify?: {
        pitch?: number;
        intensity?: number;
        timbre?: number;
        soundEffects?: string;
      };
    };
    elevenlabs?: {
      modelId?: string;
      voiceId?: string;
      outputFormat?: string;
    };
  };
};

// ========================================
// Layout Mode（佈局模式）
// ========================================

/**
 * LayoutMode 控制整體佈局行為
 * - 'title-card': 標準模式，顯示 Header + Card，VTuber 正常顯示
 * - 'card-only': 僅卡片模式，隱藏 Header，卡片全高填滿，VTuber 正常顯示
 * - 'fullscreen': 滿版模式，無邊框，VTuber fadeout
 */
export type LayoutMode = "title-card" | "card-only" | "fullscreen";

// ========================================
// Background Preset（背景預設）
// ========================================

/**
 * BackgroundPreset 控制每個 Step 的背景氛圍
 * - 'default': 深咖啡漸層（theme.colors.gradientDark）
 * - 'gradient-mesh': 多色 radial-gradient 疊加，適合重要數據或強調型畫面
 * - 'aurora': 柔和極光色帶 + 微動，適合章節開頭 / 里程碑
 * - 'spotlight': 中心高光 + 暗邊 (vignette)，適合聚焦重點
 * - 'minimal': 純深色 + 微紋理，適合 Code / Markdown
 */
export type BackgroundPreset =
  | "default"
  | "gradient-mesh"
  | "aurora"
  | "spotlight"
  | "minimal";

// ========================================
// Episode 結構
// ========================================

export type Episode = {
  metadata: EpisodeMetadata;
  /** Shell 配置；省略則由 series-config.ts 的 SERIES_CONFIG.shell 自動注入 */
  shell?: ShellConfig;
  steps: Step[];
  /** 字幕時間戳 mapping (stepId -> SubtitlePhrase[])，由 generate_audio.ts 產生 */
  subtitles?: Record<string, import("./subtitle").SubtitlePhrase[]>;
};

export type EpisodeMetadata = {
  title: string;
  subtitle?: string;
  /** 省略則由 series-config.ts 的 episodeDefaults 自動注入 */
  width?: number;
  /** 省略則由 series-config.ts 的 episodeDefaults 自動注入 */
  height?: number;
  /** 省略則由 series-config.ts 的 episodeDefaults 自動注入 */
  fps?: number;
  /** 若設為 true，則渲染時不載入 Audio 音軌（例如 Demo 用） */
  skipAudio?: boolean;
  /**
   * StreamingLayout 右側垂直裝飾文字，例如 'GSS Exception'
   * 省略則不顯示
   */
  brandTag?: string;
  /**
   * Cover 畫面左上角標籤文字，例如 'EP5 · Demo'
   * 省略則不顯示
   */
  episodeTag?: string;
  /**
   * 頻道名稱，顯示在 Cover 畫面標題列，例如 'Agentic Studio'
   * 省略則不顯示
   */
  channelName?: string;
  /** Episode-level speech overrides; merged on top of series speech defaults. */
  speech?: SpeechSpec;

  /** YouTube 上傳用 metadata（prepare publish 會回寫到這裡） */
  youtube?: {
    title: string;
    description: string;
    tags: string[];
  };

  /** 發佈結果/外部平台資訊，由 upload 階段回寫 */
  publish?: {
    youtubeVideoId?: string;
    youtubeUrl?: string;
    youtubeUploadedAt?: string;
  };

  /**
   * YouTube Thumbnail variants；存在時可用 `npx ars export thumbnail <epId>` 輸出 PNG。
   * 不進 steps[]，是獨立的 Still composition。
   * 不含 width/height（export 時固定為 1280×720）。
   *
   * 新寫法（必須用 variants 陣列）：
   *   thumbnail: {
   *     variants: [
   *       { id: "v1", cardType: "thumbnail", label: "直述標題", data: { title: "...", subtitle: "..." } },
   *       { id: "v2", cardType: "thumbnail", label: "反問鉤子", data: { title: "...？", subtitle: "..." } },
   *     ],
   *     primary: "v1",  // 省略取 variants[0]
   *   }
   *
   * @deprecated 舊寫法 `thumbnail: { title, subtitle, ... }` 已移除，請改用上方 variants 格式。
   */
  thumbnail?: {
    variants: ThumbnailVariant[];
    primary?: string;
  };
};

/**
 * ThumbnailVariant — 單一 thumbnail 候選版本。
 * 放在 episode.metadata.thumbnail.variants[]。
 *
 * - id: 省略時自動給 v1/v2/v3（取陣列 index+1）
 * - cardType: 預設 "thumbnail"，對應 CARD_REGISTRY 的 card type
 * - data: 由對應 card spec 的 Zod schema 驗證（Record<string, unknown> 以保持開放性）
 * - label: A/B test 說明，e.g. "反問鉤子"（不進 render，純工具用途）
 */
export type ThumbnailVariant = {
  id?: string;
  cardType?: string;
  data: Record<string, unknown>;
  label?: string;
};

/**
 * ThumbnailData — "thumbnail" card 的資料形狀。
 * 僅供 card registry / Still composition 使用，不是 metadata.thumbnail 的形狀。
 * metadata.thumbnail 請用 `{ variants: ThumbnailVariant[]; primary?: string }` 格式。
 */
export type ThumbnailData = {
  title: string;
  subtitle?: string;
  channelName?: string;
  episodeTag?: string;
  mascotUrl?: string;
};

/**
 * SeriesConfig — 每個 series 的統一配置
 * 由 series-config.ts 匯出，Root.tsx 自動載入
 */
export type SeriesConfig = {
  shell: ShellConfig;
  episodeDefaults: Partial<EpisodeMetadata>;
  speech: {
    provider: SpeechProviderId;
    defaults: SpeechSpec;
    reviewRequiresNativeTiming: boolean;
  };
  /** 封面縮圖設定；省略則使用 ThumbnailCard */
  thumbnail?: {
    style: "photo";
    /** 預設底圖路徑（相對 public/） */
    backgroundImage: string;
    borderGradient?: string;
    titlePosition?:
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right"
      | "center";
    logoUrl?: string;
    /** 縮圖寬度，覆蓋 episodeDefaults；預設 1280 */
    width?: number;
    /** 縮圖高度，覆蓋 episodeDefaults；預設 720 */
    height?: number;
  };
};

export type ShellConfig = {
  layout: LayoutReference;
  config: StreamingLayoutConfig;
  /** Series theme，由 config.ts 注入，runtime 決定各 series 的色系；省略則用 ThemeContext fallback */
  theme?: Theme;
  /** BGM 設定，省略則使用預設 shared/bgm/bgm.mp3 */
  bgm?: {
    src: string;
    volume?: number;
  };
};

// ========================================
// Step（時間軸片段）- 統一類型
// ========================================

/**
 * Step - 統一的時間軸片段類型
 *
 * @agent-note
 * 使用 `contentType` 決定渲染的卡片類型。
 * - Primary: `cover|ticker|summary|markdown|code|image|mermaid`
 * - Custom: globally unique card type string (e.g. `normal-distribution`)
 * - Legacy alias: `text`
 */
export type Step = {
  id: string;
  /** Primary: cover/ticker/summary/markdown/code/image/mermaid; custom: globally unique card type string; legacy alias: text */
  contentType:
    | "cover"
    | "text" // @legacy -> 改用 markdown
    | "code"
    | "image"
    | "mermaid"
    | "markdown"
    | "summary"
    | "ticker"
    | (string & {});
  /** Card payload resolved by the CardSpec for this contentType. */
  data?: unknown;
  /** 佈局模式：title-card（預設）| card-only | fullscreen */
  layoutMode?: LayoutMode;
  /** 背景預設：default | gradient-mesh | aurora | spotlight | minimal */
  background?: BackgroundPreset;
  narration: string;
  durationInSeconds: number;

  // Header (title-card mode)
  title?: string;
  description?: string;
  phase?: string;

  /** 跳過此 step 的 enter/exit 過場動畫（連續 fullscreen 不閃黑） */
  skipTransition?: boolean;

  // Card entrance effect (applied by CardEffect wrapper)
  /** 卡片進場特效，預設 'fadeIn' */
  effect?: StepEffect;
  /** 特效參數覆寫 */
  effectConfig?: EffectConfig;

  /** Step-level speech overrides; merged on top of episode + series speech. */
  speech?: SpeechSpec;
};
