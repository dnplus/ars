/**
 * Theme 型別定義 — 單一真相
 * 各 series 的 theme.ts 必須 export 符合此型別的物件
 */
export type Theme = {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surfaceLight: string;
    surfaceDark: string;
    surfaceCard: string;
    surfaceCardHeader: string;
    surfaceCode: string;
    surfaceOverlay: string;
    onLight: string;
    onDark: string;
    onCard: string;
    onCardMuted: string;
    onPrimary: string;
    onCode: string;
    positive: string;
    negative: string;
    info: string;
    warning: string;
    highlight: string;
    gradientDark: string;
    gradientGold: string;
    gradientShimmer: string;
    border: string;
    borderLight: string;
    shadow: string;
    shadowDark: string;
    // legacy aliases
    bgLight: string;
    bgDark: string;
    textMain: string;
    textInverse: string;
    textMuted: string;
    textLight: string;
    cardBg: string;
    cardHeaderBg: string;
    codeBackground: string;
  };
  fonts: {
    main: string;
    code: string;
    fallback: string;
  };
};
