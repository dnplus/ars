/**
 * @module shared/types
 * @description Global Type Definitions / Data Schema
 *
 * @agent-note
 * This is the **Source of Truth** for the "Content as Code" schema.
 * - `Episode`: Root structure map to a video.
 * - `Step`: The polymorphic unit of content. Check `contentType` to discriminate.
 *   - Primary: `cover|ticker|summary|markdown|code|image|stats|compare|timeline|flowchart|mermaid|mockApp`
 *   - Legacy: `text|terminal|macApp|phone`
 *   - Advanced: `liveScene|threeScene`
 *
 * @architectural-role Dictionary
 * Used by: `src/episodes/*.ts`, `src/Composition.tsx`, `scripts/*.ts`
 */

import type { LayoutReference } from "../layouts";
import type { StreamingLayoutConfig } from "../layouts/StreamingLayout";
import type { StepEffect, EffectConfig } from "./effects/CardEffect";
import type { Theme } from "./theme";

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
 * - 'gradient-mesh': 多色 radial-gradient 疊加，適合 StatsCard / 重要數據
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
  /**
   * Episode ID（已棄用 - 現由檔名自動推導）
   * @deprecated 不再需要手動指定，系統會從檔名自動推導
   */
  id?: string;
  /**
   * Series 名稱（已棄用 - 現由目錄名自動推導）
   * @deprecated Root.tsx 和 slides-main.tsx 會自動從目錄名注入
   */
  series?: string;
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
  decorationText?: string;
  /**
   * CoverCard 左上角標籤文字，例如 'EP5 · GSS'
   * 省略則不顯示
   */
  episodeTag?: string;
  /**
   * 頻道名稱，顯示在 CoverCard 標題列，例如 'Agentic Studio'
   * 省略則不顯示
   */
  channelName?: string;
  /** TTS voice ID，整集預設聲音；可在 Step 層級 override */
  voiceId?: string;

  /** YouTube 上傳用 metadata（prepare publish 會回寫到這裡） */
  youtube?: {
    title: string;
    description: string;
    tags: string[];
  };

  /** 社群發文（Threads / FB Group 共用；prepare publish 會回寫到這裡） */
  social?: {
    /** posts[0] 是可獨立成立的主文；posts[1..n] 是 Threads reply chain */
    posts: string[];
    /** 圖卡路徑（repo root relative 或絕對路徑），省略則 upload 預設用 cover */
    imageAssets?: string[];
  };

  /** 發佈結果/外部平台資訊，由 upload 階段回寫 */
  publish?: {
    youtubeVideoId?: string;
    youtubeUrl?: string;
    youtubeUploadedAt?: string;
  };
};

/**
 * SeriesConfig — 每個 series 的統一配置
 * 由 series-config.ts 匯出，Root.tsx / slides-main.tsx 自動載入
 */
export type SeriesConfig = {
  shell: ShellConfig;
  episodeDefaults: Partial<EpisodeMetadata>;
  /** TTS 聲音微調（MiniMax speech-02-hd）；省略則用預設值 */
  tts?: {
    /** 語速 0.5~2.0 */
    speed?: number;
    /** 音高 -12~12（正值高亢/年輕，負值低沉） */
    pitch?: number;
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
  scene: "webinar";
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

// Shared CTA types
export type CTAButton = { label: string; icon?: string };
export type QRCodeCTA = { url: string; title?: string; subtitle?: string };

/**
 * Step - 統一的時間軸片段類型
 *
 * @agent-note
 * 使用 `contentType` 決定渲染的卡片類型。
 * - Primary: `cover|ticker|summary|markdown|code|image|stats|compare|timeline|flowchart|mermaid|mockApp`
 * - Legacy: `text|terminal|macApp|phone`
 * - Advanced: `liveScene|threeScene`
 */
export type Step = {
  id: string;
  /** Primary: cover/ticker/summary/markdown/code/image/stats/compare/timeline/flowchart/mermaid/mockApp; Legacy: text/terminal/macApp/phone; Advanced: liveScene/threeScene */
  contentType:
    | "cover"
    | "text" // @legacy -> 改用 markdown
    | "code"
    | "image"
    | "mermaid"
    | "markdown"
    | "summary"
    | "ticker"
    | "compare"
    | "stats"
    | "timeline"
    | "liveScene" // @advanced
    | "threeScene" // @advanced
    | "terminal" // @legacy -> 改用 mockApp + appType:'terminal'
    | "phone" // @legacy -> 改用 mockApp + appDevice:'mobile'
    | "macApp" // @legacy -> 改用 mockApp + appDevice:'desktop'
    | "mockApp"
    | "flowchart";
  /** 佈局模式：title-card（預設）| card-only | fullscreen */
  layoutMode?: LayoutMode;
  /** 背景預設：default | gradient-mesh | aurora | spotlight | minimal */
  backgroundPreset?: BackgroundPreset;
  narration: string;
  durationInSeconds: number;

  // Header (title-card mode)
  title?: string;
  description?: string;
  phase?: string;

  /** 跳過此 step 的 enter/exit 過場動畫（連續 fullscreen 不閃黑） */
  skipTransition?: boolean;

  // Cover Card background effect
  animation?: "matrix" | "none";

  // Card entrance effect (applied by CardEffect wrapper)
  /** 卡片進場特效，預設 'fadeIn' */
  effect?: StepEffect;
  /** 特效參數覆寫 */
  effectConfig?: EffectConfig;

  // Text/Markdown Card
  cardTitle?: string;
  cardTag?: string;
  tagColor?: string;
  cardContent?: string;

  // Code Card
  windowTitle?: string;
  code?: string;
  language?: string;

  // Image Card
  imageTitle?: string;
  imageSrc?: string;
  imageCaption?: string;

  // Dashboard / chart primitive（供 mockApp dashboard 重用）
  chartType?: "bar" | "line" | "pie";
  chartData?: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  chartValuePrefix?: string;
  chartValueSuffix?: string;
  chartYMax?: number;
  chartHighlightIndex?: number;
  chartShowLegend?: boolean;
  chartSourceLabel?: string;

  // Mermaid Card
  mermaidTitle?: string;
  mermaidChart?: string;

  // Video Card
  videoSrc?: string;

  // Context Visualizer
  ctx?: Record<string, string | number | boolean>;
  visTitle?: string;
  visIcon?: string;

  // Summary Card
  summaryTitle?: string;
  summaryPoints?: string[];
  summaryCtaButtons?: CTAButton[];
  summaryQrCodes?: QRCodeCTA[];
  summaryShowCta?: boolean;

  // Ticker Card
  tickerDirection?: "horizontal" | "vertical";
  tickerStyle?: "flash" | "kinetic";

  // Compare Card
  compareLeftTitle?: string;
  compareLeftItems?: string[];
  compareRightTitle?: string;
  compareRightItems?: string[];
  compareLeftColor?: string;
  compareRightColor?: string;

  // Stats Card
  stats?: { value: string; label: string; prefix?: string; suffix?: string }[];

  // Timeline Card
  timelineItems?: { title: string; description?: string; icon?: string }[];

  // Live Scene Card (動態像素房間背景)
  /** JSON stringified LiveSceneData object */
  liveScene?: string;

  // Three.js Scene Card
  /** Three.js scene preset: 'particles' | 'orbit' | 'nodes' | 'orb' */
  threeSceneType?: "particles" | "orbit" | "nodes" | "orb";
  /** Headline text overlay on 3D scene */
  threeHeadline?: string;
  /** Body text overlay on 3D scene */
  threeBodyText?: string;
  /** Text overlay style: 'glass' (glassmorphism card) | 'bare' (text with shadow) | 'none' */
  threeTextStyle?: "glass" | "bare" | "none";
  /** Node data for 'nodes' scene type */
  threeNodes?: {
    label: string;
    position: [number, number, number];
    color: string;
    delay?: number;
    broken?: boolean;
  }[];
  /** Override primary color for Three.js scene */
  threePrimaryColor?: string;
  /** Override secondary color for Three.js scene */
  threeSecondaryColor?: string;

  // Terminal Card（CLI 打字機動畫；@legacy，新稿優先改用 mockApp + appType:'terminal'）
  terminalLines?: {
    type: "command" | "output";
    text: string;
    pauseAfter?: number;
  }[];
  terminalTitle?: string;
  terminalCharsPerSecond?: number;

  // App Card（手機 mockup 或 mac 視窗 + App 內容；@legacy alias 支援 phone/macApp，mockApp 也共用這組欄位）
  /** App 類型：legacy 'claude' 或 mockApp 的 'chat' | 'terminal' | 'browser' | 'dashboard' */
  appType?: "claude" | "chat" | "terminal" | "browser" | "dashboard";
  /** mockApp 載體：desktop | mobile */
  appDevice?: "desktop" | "mobile";
  appMessages?: {
    role: "user" | "assistant";
    text: string;
    pauseAfter?: number;
    /** 程式碼 / 文件 artifact */
    artifact?: {
      label: string;
      language?: string;
      preview?: string;
      lines?: string;
    };
    /** Diff / View PR 等 badge 按鈕 */
    badges?: { label: string; value?: string; color: string }[];
    /** Git branch name */
    branch?: string;
    /** 簡易 placeholder 色塊 */
    placeholder?: { label: string; color: string; height?: number };
  }[];
  appName?: string;
  appCharsPerSecond?: number;
  appInputPlaceholder?: string;
  /** mockApp browser mode */
  appBrowserMode?: "meta" | "snapshot";
  /** mockApp browser screenshot preset */
  appBrowserLayout?: "normal" | "square" | "mobile";
  appUrl?: string;
  /** image/browser preview 共用資源，避免再引入另一組欄位 */
  appImageSrc?: string;
  appInsight?: string;
  /** mockApp dashboard 專用欄位，scene 會回退到通用 chart* 欄位 */
  dashboardChartType?: "bar" | "line" | "pie";
  dashboardChartData?: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  dashboardValuePrefix?: string;
  dashboardValueSuffix?: string;
  dashboardSourceLabel?: string;
  dashboardInsight?: string;

  // Flowchart Card（純 React SVG + dagre 自動排版）
  flowchartNodes?: { id: string; label: string; icon?: string }[];
  flowchartEdges?: { from: string; to: string; label?: string }[];
  flowchartDirection?: 'TB' | 'LR';
  /** 節點揭露順序；省略則全部一次顯示（無動畫） */
  flowchartFocusOrder?: string[];

  /** 此 step 的 TTS 聲音，覆蓋 episode.metadata.voiceId（多人對話用） */
  voiceId?: string;
  /** 此 step 的 TTS 語速（0.5~2.0），覆蓋 series tts.speed / CLI --speed */
  speed?: number;
  /** 此 step 的 TTS pitch（-12~12），覆蓋 series tts.pitch */
  pitch?: number;
};
