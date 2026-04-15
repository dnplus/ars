import React, { createContext, useContext } from 'react';
import type { Theme } from './theme';

/**
 * Static fallback theme — 用於沒有 ThemeProvider 包裹的元件。
 * 這是 GSS "Deep Space Blue" palette 的精簡版本，
 * 正常流程中永遠會被 series-config 的 theme 覆蓋。
 */
export const FALLBACK_THEME: Theme = {
  colors: {
    primary: "#173D96",
    secondary: "#384045",
    accent: "#4F6DB3",
    surfaceLight: "#FFFFFF",
    surfaceDark: "#0A1A3F",
    surfaceCard: "#FFFFFF",
    surfaceCardHeader: "#F0F7FF",
    surfaceCode: "#1e1e1e",
    surfaceOverlay: "rgba(10, 26, 63, 0.85)",
    onLight: "#384045",
    onDark: "#FFFFFF",
    onCard: "#384045",
    onCardMuted: "rgba(56, 64, 69, 0.6)",
    onPrimary: "#FFFFFF",
    onCode: "#d4d4d4",
    positive: "#4ade80",
    negative: "#f87171",
    info: "#60a5fa",
    warning: "#fbbf24",
    highlight: "#a78bfa",
    gradientDark: "linear-gradient(135deg, #0A1A3F 0%, #173D96 100%)",
    gradientGold: "linear-gradient(135deg, #173D96, #4F6DB3)",
    gradientShimmer: "linear-gradient(90deg, #173D96, #607EBF, #173D96)",
    border: "#E3EDF2",
    borderLight: "rgba(23, 61, 150, 0.1)",
    shadow: "rgba(23, 61, 150, 0.15)",
    shadowDark: "rgba(0, 0, 0, 0.4)",
    bgLight: "#FFFFFF",
    bgDark: "#0A1A3F",
    textMain: "#384045",
    textInverse: "#FFFFFF",
    textMuted: "#8597A0",
    textLight: "#e2e8f0",
    cardBg: "#FFFFFF",
    cardHeaderBg: "#F0F7FF",
    codeBackground: "#1e1e1e",
  },
  fonts: {
    main: '"Noto Sans TC", sans-serif',
    code: '"JetBrains Mono", "Fira Code", monospace',
    fallback: '"Inter", system-ui, sans-serif',
  },
};

export const ThemeContext = createContext<Theme>(FALLBACK_THEME);

export const ThemeProvider: React.FC<{ theme?: Theme; children: React.ReactNode }> = ({
  theme,
  children,
}) => theme
  ? <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  : <>{children}</>;

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
