import type { Theme } from './theme';

export type ThemeSeed = {
  mode: 'dark' | 'light';
  primary: string;
  accent?: string;
  surfaceTone?: 'warm' | 'cool' | 'neutral';
  contrast?: 'high' | 'medium' | 'soft';
  font?: { main?: string; code?: string };
  override?: Partial<Theme['colors']>;
};

type HslColor = {
  h: number;
  s: number;
  l: number;
};

const HEX_COLOR_RE = /^#?[0-9a-f]{6}$/i;

export const SEED_COMMENT_MARKER = '// @ars-theme-seed ';

export function serializeSeed(seed: ThemeSeed): string {
  return JSON.stringify(seed);
}

export function parseSeed(serialized: string): ThemeSeed {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid theme seed JSON: ${detail}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Theme seed must be a JSON object');
  }

  const seed = parsed as Record<string, unknown>;
  const mode = seed.mode;
  const primary = seed.primary;

  if (mode !== 'dark' && mode !== 'light') {
    throw new Error('Theme seed requires mode: "dark" | "light"');
  }

  if (typeof primary !== 'string' || !HEX_COLOR_RE.test(primary)) {
    throw new Error('Theme seed requires primary as a 6-digit hex color');
  }

  if (
    seed.accent !== undefined &&
    (typeof seed.accent !== 'string' || !HEX_COLOR_RE.test(seed.accent))
  ) {
    throw new Error('Theme seed accent must be a 6-digit hex color');
  }

  if (
    seed.surfaceTone !== undefined &&
    seed.surfaceTone !== 'warm' &&
    seed.surfaceTone !== 'cool' &&
    seed.surfaceTone !== 'neutral'
  ) {
    throw new Error('Theme seed surfaceTone must be warm, cool, or neutral');
  }

  if (
    seed.contrast !== undefined &&
    seed.contrast !== 'high' &&
    seed.contrast !== 'medium' &&
    seed.contrast !== 'soft'
  ) {
    throw new Error('Theme seed contrast must be high, medium, or soft');
  }

  if (
    seed.font !== undefined &&
    (!seed.font ||
      typeof seed.font !== 'object' ||
      Array.isArray(seed.font) ||
      ('main' in seed.font &&
        seed.font.main !== undefined &&
        typeof seed.font.main !== 'string') ||
      ('code' in seed.font &&
        seed.font.code !== undefined &&
        typeof seed.font.code !== 'string'))
  ) {
    throw new Error('Theme seed font must be an object with optional main/code strings');
  }

  if (
    seed.override !== undefined &&
    (!seed.override || typeof seed.override !== 'object' || Array.isArray(seed.override))
  ) {
    throw new Error('Theme seed override must be an object');
  }

  const fontSeed =
    seed.font && typeof seed.font === 'object' && !Array.isArray(seed.font)
      ? (seed.font as { main?: unknown; code?: unknown })
      : undefined;

  return {
    mode,
    primary: normalizeHex(primary),
    accent: typeof seed.accent === 'string' ? normalizeHex(seed.accent) : undefined,
    surfaceTone:
      seed.surfaceTone === 'warm' || seed.surfaceTone === 'cool' || seed.surfaceTone === 'neutral'
        ? seed.surfaceTone
        : 'neutral',
    contrast:
      seed.contrast === 'high' || seed.contrast === 'medium' || seed.contrast === 'soft'
        ? seed.contrast
        : 'medium',
    font:
      fontSeed
        ? {
            main: typeof fontSeed.main === 'string' ? fontSeed.main : undefined,
            code: typeof fontSeed.code === 'string' ? fontSeed.code : undefined,
          }
        : undefined,
    override: (seed.override as Partial<Theme['colors']> | undefined) ?? undefined,
  };
}

export function adjustHexLightness(hex: string, delta: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(hsl.l + delta, 0, 100) });
}

export function deriveTheme(rawSeed: ThemeSeed): Theme {
  const seed = parseSeed(serializeSeed(rawSeed));
  const primary = normalizeHex(seed.primary);
  const primaryHsl = hexToHsl(primary);
  const accent =
    seed.accent !== undefined
      ? normalizeHex(seed.accent)
      : hslToHex({ ...primaryHsl, h: mod(primaryHsl.h + 30, 360) });
  const accentHsl = hexToHsl(accent);
  const surfaceTone = seed.surfaceTone ?? 'neutral';
  const contrast = seed.contrast ?? 'medium';

  const surfaceSaturation = clamp(
    primaryHsl.s +
      (surfaceTone === 'warm' ? 5 : 0) +
      (surfaceTone === 'cool' ? -5 : 0),
    0,
    100
  );
  const darknessMap = { high: 8, medium: 10, soft: 12 } as const;
  const lightnessMap = { high: 92, medium: 94, soft: 96 } as const;
  const baseSurfaceDark = hslToHex({
    h: primaryHsl.h,
    s: surfaceSaturation,
    l: seed.mode === 'dark' ? darknessMap[contrast] : lightnessMap[contrast],
  });
  const surfaceLight = hslToHex({
    h: primaryHsl.h,
    s: clamp(surfaceSaturation - 2, 0, 100),
    l: seed.mode === 'light' ? 97 : 18,
  });
  const surfaceCard = adjustHexLightness(baseSurfaceDark, 5);
  const surfaceCardHeader = adjustHexLightness(baseSurfaceDark, 8);
  const surfaceCode = adjustHexLightness(baseSurfaceDark, 3);
  const border = hslToHex({
    h: primaryHsl.h,
    s: 20,
    l: seed.mode === 'dark' ? 25 : 80,
  });
  const secondary = hslToHex({
    h: primaryHsl.h,
    s: clamp(primaryHsl.s - 20, 0, 100),
    l: seed.mode === 'dark' ? clamp(primaryHsl.l + 8, 20, 70) : clamp(primaryHsl.l - 10, 20, 70),
  });

  const onDark = ensureReadableText(
    seed.mode === 'dark' ? '#ffffff' : baseSurfaceDark,
    baseSurfaceDark
  );
  const onLight = ensureReadableText(
    seed.mode === 'dark' ? baseSurfaceDark : onDark,
    surfaceLight
  );
  const onCard = ensureReadableText(onDark, surfaceCard);

  const derived: Theme['colors'] = {
    primary,
    secondary,
    accent,
    surfaceLight,
    surfaceDark: baseSurfaceDark,
    surfaceCard,
    surfaceCardHeader,
    surfaceCode,
    surfaceOverlay: rgbaString(primary, 0.6),
    onLight,
    onDark,
    onCard,
    onCardMuted: rgbaString(onCard, 0.6),
    onPrimary: relativeLuminance(primary) > 0.45 ? '#000000' : '#ffffff',
    onCode: '#a5f3fc',
    positive: hslToHex({ h: 142, s: 70, l: 45 }),
    negative: hslToHex({ h: 0, s: 72, l: 51 }),
    info: hslToHex({ h: 217, s: 91, l: 60 }),
    warning: hslToHex({ h: 45, s: 93, l: 47 }),
    highlight: hslToHex({
      h: accentHsl.h,
      s: clamp(accentHsl.s + 10, 0, 100),
      l: clamp(accentHsl.l + 15, 0, 100),
    }),
    gradientDark: `linear-gradient(135deg, ${baseSurfaceDark} 0%, ${surfaceCard} 100%)`,
    gradientGold: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
    gradientShimmer: `linear-gradient(90deg, ${primary}00 0%, ${primary}66 50%, ${primary}00 100%)`,
    border,
    borderLight: rgbaString(border, 0.5),
    shadow: 'rgba(0,0,0,0.25)',
    shadowDark: 'rgba(0,0,0,0.5)',
    bgLight: surfaceLight,
    bgDark: baseSurfaceDark,
    textMain: onDark,
    textInverse: onLight,
    textMuted: rgbaString(onCard, 0.6),
    textLight: onLight,
    cardBg: surfaceCard,
    cardHeaderBg: surfaceCardHeader,
    codeBackground: surfaceCode,
  };

  return {
    colors: {
      ...derived,
      ...(seed.override ?? {}),
    },
    fonts: {
      main: seed.font?.main ?? '"Noto Sans TC", sans-serif',
      code: seed.font?.code ?? '"JetBrains Mono", monospace',
      fallback: 'system-ui, sans-serif',
    },
  };
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return normalized.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function hexToHsl(hex: string): HslColor {
  const { r, g, b } = hexToRgb(hex);
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  if (delta !== 0) {
    if (max === nr) {
      h = ((ng - nb) / delta) % 6;
    } else if (max === ng) {
      h = (nb - nr) / delta + 2;
    } else {
      h = (nr - ng) / delta + 4;
    }
  }

  const s =
    delta === 0
      ? 0
      : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: mod(h * 60, 360),
    s: round(s * 100),
    l: round(l * 100),
  };
}

function hslToHex(color: HslColor): string {
  const h = mod(color.h, 360);
  const s = clamp(color.s, 0, 100) / 100;
  const l = clamp(color.l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) {
    rPrime = c;
    gPrime = x;
  } else if (h < 120) {
    rPrime = x;
    gPrime = c;
  } else if (h < 180) {
    gPrime = c;
    bPrime = x;
  } else if (h < 240) {
    gPrime = x;
    bPrime = c;
  } else if (h < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return rgbToHex(
    Math.round((rPrime + m) * 255),
    Math.round((gPrime + m) * 255),
    Math.round((bPrime + m) * 255)
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function rgbaString(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * transform(r) +
    0.7152 * transform(g) +
    0.0722 * transform(b)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureReadableText(candidate: string, background: string): string {
  const normalizedCandidate = normalizeHex(candidate);
  const normalizedBackground = normalizeHex(background);
  if (contrastRatio(normalizedCandidate, normalizedBackground) >= 4.5) {
    return normalizedCandidate;
  }

  const options = ['#000000', '#ffffff', adjustHexLightness(normalizedBackground, -75), adjustHexLightness(normalizedBackground, 75)];
  const best = options
    .map((option) => normalizeHex(option))
    .sort((left, right) => contrastRatio(right, normalizedBackground) - contrastRatio(left, normalizedBackground))[0];
  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
