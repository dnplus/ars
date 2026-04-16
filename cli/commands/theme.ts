/**
 * @command theme
 * @description Generate, tweak, or preview a series theme
 *
 * Usage:
 *   npx ars theme generate <series> [--prompt <text>] [--preset <name>]
 *   npx ars theme tweak <series> --instruction <text>
 *   npx ars theme preview <series>
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Theme } from '../../src/engine/shared/theme';
import {
  SEED_COMMENT_MARKER,
  adjustHexLightness,
  deriveTheme,
  parseSeed,
  serializeSeed,
  type ThemeSeed,
} from '../../src/engine/shared/theme-derive';
import { getRepoRoot } from '../lib/ars-config';

export const THEME_PRESETS: Record<string, ThemeSeed> = {
  'gold-dark': {
    mode: 'dark',
    primary: '#c4a77d',
    surfaceTone: 'warm',
    contrast: 'high',
  },
  'indigo-dark': {
    mode: 'dark',
    primary: '#6366f1',
    surfaceTone: 'cool',
    contrast: 'medium',
  },
  'green-dark': {
    mode: 'dark',
    primary: '#4ade80',
    surfaceTone: 'neutral',
    contrast: 'medium',
  },
  'minimal-light': {
    mode: 'light',
    primary: '#3b82f6',
    surfaceTone: 'cool',
    contrast: 'high',
  },
};

const HELP = `
Usage:
  npx ars theme generate <series> [--prompt <text>] [--preset <name>]
  npx ars theme tweak <series> --instruction <text>
  npx ars theme preview <series>
`;

export async function run(args: string[]) {
  const [subcommand, series, ...rest] = args;

  if (!subcommand || !series) {
    console.error(HELP.trim());
    process.exit(1);
  }

  switch (subcommand) {
    case 'generate':
      await runGenerate(series, rest);
      return;
    case 'tweak':
      await runTweak(series, rest);
      return;
    case 'preview':
      await runPreview(series);
      return;
    default:
      console.error(`❌ Unknown theme subcommand: ${subcommand}`);
      console.error(HELP.trim());
      process.exit(1);
  }
}

async function runGenerate(series: string, args: string[]) {
  const seriesConfigPath = resolveSeriesConfigPath(series);
  const presetName = readOption(args, '--preset');
  const prompt = readOption(args, '--prompt');

  const basePreset = presetName ? loadPreset(presetName) : cloneSeed(THEME_PRESETS['indigo-dark']);
  const seed = prompt ? promptToSeed(prompt, basePreset) : basePreset;
  const theme = deriveTheme(seed);
  writeThemeToSeriesConfig(seriesConfigPath, seed, theme);

  console.log("Theme generated. Run 'npm run dev' and open Remotion Studio → theme-preview/" + series);
}

async function runTweak(series: string, args: string[]) {
  const seriesConfigPath = resolveSeriesConfigPath(series);
  const instruction = readOption(args, '--instruction');
  if (!instruction) {
    console.error('❌ Please provide --instruction "<text>"');
    process.exit(1);
  }

  const currentSource = fs.readFileSync(seriesConfigPath, 'utf8');
  const seed = extractSeedFromConfig(currentSource);
  const changes = applyInstruction(seed, instruction);
  const theme = deriveTheme(seed);
  writeThemeToSeriesConfig(seriesConfigPath, seed, theme);

  const summary = changes.length ? changes.join(', ') : 'no heuristic-mapped fields';
  console.log(`Theme tweaked. Changed fields: ${summary}`);
}

async function runPreview(series: string) {
  resolveSeriesConfigPath(series);
  console.log(`Open Remotion Studio: npm run dev, then navigate to theme-preview/${series}`);

  try {
    const response = await fetch('http://localhost:3000', {
      signal: AbortSignal.timeout(500),
    });
    if (response.ok) {
      openUrl('http://localhost:3000');
    }
  } catch {
    // Studio not running; message above is enough.
  }
}

function resolveSeriesConfigPath(series: string): string {
  if (!series || series.includes('/') || /\s/.test(series)) {
    console.error('❌ Series name cannot contain / or spaces');
    process.exit(1);
  }

  const root = getRepoRoot();
  const configPath = path.join(root, 'src/episodes', series, 'series-config.ts');
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Series "${series}" not found at src/episodes/${series}/series-config.ts`);
    process.exit(1);
  }

  return configPath;
}

function readOption(args: string[], optionName: string): string | undefined {
  const index = args.indexOf(optionName);
  if (index === -1) return undefined;
  return args[index + 1];
}

function loadPreset(name: string): ThemeSeed {
  const preset = THEME_PRESETS[name];
  if (!preset) {
    console.error(`❌ Unknown preset "${name}". Available presets: ${Object.keys(THEME_PRESETS).join(', ')}`);
    process.exit(1);
  }

  return cloneSeed(preset);
}

function cloneSeed(seed: ThemeSeed): ThemeSeed {
  return JSON.parse(JSON.stringify(seed)) as ThemeSeed;
}

function promptToSeed(prompt: string, baseSeed?: ThemeSeed): ThemeSeed {
  const base = cloneSeed(baseSeed ?? THEME_PRESETS['indigo-dark']);
  const lowered = prompt.toLowerCase();

  if (hasAny(lowered, ['金', 'gold'])) {
    base.primary = '#c4a77d';
    base.surfaceTone = 'warm';
  } else if (hasAny(lowered, ['藍', 'blue'])) {
    base.primary = '#4a90d9';
    base.surfaceTone = 'cool';
  } else if (hasAny(lowered, ['綠', 'green'])) {
    base.primary = '#4caf7a';
    base.surfaceTone = 'neutral';
  } else if (hasAny(lowered, ['紫', 'purple'])) {
    base.primary = '#9b6bcc';
    base.surfaceTone = 'neutral';
  }

  if (hasAny(lowered, ['科技', 'tech', 'dark'])) {
    base.mode = 'dark';
    base.surfaceTone = base.surfaceTone ?? 'cool';
  }

  if (hasAny(lowered, ['明亮', 'light', 'clean'])) {
    base.mode = 'light';
    base.contrast = 'high';
  }

  if (hasAny(lowered, ['warm', 'earth', 'earthy', '暖', '土'])) {
    base.surfaceTone = 'warm';
  } else if (hasAny(lowered, ['cool', 'icy', '冷'])) {
    base.surfaceTone = 'cool';
  }

  if (hasAny(lowered, ['soft', 'gentle', '柔和'])) {
    base.contrast = 'soft';
  }
  if (hasAny(lowered, ['bold', 'high contrast', 'strong', '高對比'])) {
    base.contrast = 'high';
  }

  return base;
}

function applyInstruction(seed: ThemeSeed, instruction: string): string[] {
  const changes: string[] = [];
  const lowered = instruction.toLowerCase();

  if (hasAny(lowered, ['accent 調亮', 'brighter accent'])) {
    const accent = seed.accent ?? deriveAccent(seed.primary);
    seed.accent = adjustHexLightness(accent, 15);
    changes.push('accent');
  }

  if (hasAny(lowered, ['primary 調暗', 'darker primary'])) {
    seed.primary = adjustHexLightness(seed.primary, -10);
    changes.push('primary');
  }

  if (hasAny(lowered, ['high contrast'])) {
    if (seed.contrast !== 'high') {
      seed.contrast = 'high';
      changes.push('contrast');
    }
  }

  return Array.from(new Set(changes));
}

function deriveAccent(primary: string): string {
  const theme = deriveTheme({ mode: 'dark', primary });
  return theme.colors.accent;
}

function extractSeedFromConfig(source: string): ThemeSeed {
  const markerPattern = new RegExp(`^${escapeRegExp(SEED_COMMENT_MARKER)}(.+)$`, 'm');
  const match = source.match(markerPattern);
  if (!match) {
    throw new Error(
      'No theme seed found in series-config.ts. Run `npx ars theme generate <series> --prompt "<description>"` first.'
    );
  }

  return parseSeed(match[1]);
}

function writeThemeToSeriesConfig(filePath: string, seed: ThemeSeed, theme: Theme) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceWithoutMarker = source.replace(
    new RegExp(`^${escapeRegExp(SEED_COMMENT_MARKER)}.*\\n?`, 'm'),
    ''
  );
  const themeRange = findThemeDeclarationRange(sourceWithoutMarker);
  const replacement = `${SEED_COMMENT_MARKER}${serializeSeed(seed)}\n${formatThemeDeclaration(theme)}`;
  const nextSource =
    sourceWithoutMarker.slice(0, themeRange.start) +
    replacement +
    sourceWithoutMarker.slice(themeRange.end);

  fs.writeFileSync(filePath, nextSource);
}

function formatThemeDeclaration(theme: Theme): string {
  return `const theme = ${JSON.stringify(theme, null, 2)};`;
}

function findThemeDeclarationRange(source: string): { start: number; end: number } {
  const declaration = 'const theme =';
  const start = source.indexOf(declaration);
  if (start === -1) {
    throw new Error('Could not find `const theme =` in series-config.ts');
  }

  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error('Could not parse theme object in series-config.ts');
  }

  let depth = 0;
  let stringDelimiter: '"' | "'" | '`' | null = null;
  let isEscaped = false;
  let endBrace = -1;

  for (let index = braceStart; index < source.length; index++) {
    const char = source[index];

    if (stringDelimiter) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringDelimiter) {
        stringDelimiter = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      stringDelimiter = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        endBrace = index;
        break;
      }
    }
  }

  if (endBrace === -1) {
    throw new Error('Could not find the end of the theme object in series-config.ts');
  }

  const end = source.indexOf(';', endBrace);
  if (end === -1) {
    throw new Error('Could not find the end of the theme declaration in series-config.ts');
  }

  return { start, end: end + 1 };
}

function hasAny(input: string, matches: string[]): boolean {
  return matches.some((match) => input.includes(match));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openUrl(url: string) {
  try {
    if (process.platform === 'darwin') {
      execFileSync('open', [url], { stdio: 'ignore' });
      return;
    }
    if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
      return;
    }
    execFileSync('xdg-open', [url], { stdio: 'ignore' });
  } catch {
    // Opening a browser is best-effort only.
  }
}
