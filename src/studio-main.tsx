/// <reference types="vite/client" />
/**
 * @module studio-main
 * @description ARS Studio Entry Point
 *              掃描所有 series，URL 參數：?series=template&ep=ep-demo
 *              自動注入 series-config.ts 的 shell + episodeDefaults
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './engine/studio/StudioApp';
import { Episode, SeriesConfig } from './engine/shared/types';

// ── 載入 series-config.ts ──
const rawSeriesConfigs = import.meta.glob(
  './episodes/*/series-config.ts',
  { eager: true }
) as Record<string, Record<string, unknown>>;

const seriesConfigs: Record<string, SeriesConfig> = {};
for (const filePath in rawSeriesConfigs) {
  const match = filePath.match(/\.\/episodes\/([^/]+)\/series-config\.ts$/);
  if (!match) continue;
  const series = match[1];
  const mod = rawSeriesConfigs[filePath];
  if (mod.SERIES_CONFIG) {
    seriesConfigs[series] = mod.SERIES_CONFIG as SeriesConfig;
  }
}

// 全局 fallback
const GLOBAL_FALLBACK = { width: 1920, height: 1080, fps: 30 } as const;

// ── 載入所有 episodes ──
const rawModules = import.meta.glob(
  './episodes/**/*.ts',
  { eager: true }
) as Record<string, Record<string, unknown>>;

// 建立 seriesMap: Record<series, Record<epId, Episode>>
const seriesMap: Record<string, Record<string, Episode>> = {};

for (const filePath in rawModules) {
  // 排除非 episode 檔案
  if (
    filePath.includes('.subtitles.') ||
    filePath.includes('.template.') ||
    filePath.endsWith('/config.ts') ||
    filePath.endsWith('/theme.ts') ||
    filePath.endsWith('/series-config.ts')
  ) continue;

  const match = filePath.match(/\.\/episodes\/([^/]+)\/(ep[^/]+)\.ts$/);
  if (!match) continue;
  const [, series, epId] = match;

  const mod = rawModules[filePath];
  const episode = Object.values(mod).find(
    (exp): exp is Episode =>
      typeof exp === 'object' && exp !== null && 'steps' in (exp as Record<string, unknown>)
  ) as Episode | undefined;

  if (episode) {
    if (!seriesMap[series]) seriesMap[series] = {};

    const sc = seriesConfigs[series];
    const scShell = sc?.shell;
    const epShell = episode.shell;
    const shell = epShell
      ? { ...epShell, theme: epShell.theme ?? scShell?.theme }
      : scShell;
    const defaults = sc?.episodeDefaults ?? {};

    seriesMap[series][epId] = {
      ...episode,
      shell,
      metadata: {
        ...GLOBAL_FALLBACK,
        ...defaults,
        ...episode.metadata,
      },
    };
  }
}

// URL: ?series=template&ep=ep-demo
const urlParams = new URLSearchParams(window.location.search);
const availableSeriesKeys = Object.keys(seriesMap).sort();
const targetSeries = urlParams.get('series') || availableSeriesKeys[0] || 'template';
const seriesEpisodes = seriesMap[targetSeries] || {};
const availableEpisodeIds = Object.keys(seriesEpisodes).sort();
const episodeId = urlParams.get('ep') || availableEpisodeIds[0] || 'ep-demo';
const episode = seriesEpisodes[episodeId] ?? null;

if (!episode) {
  document.body.innerHTML = `
    <div style="
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; background: #0a1628; color: #e2e8f0;
      font-family: system-ui, sans-serif; text-align: center; padding: 20px;
    ">
      <h1 style="color: #60a5fa; margin-bottom: 16px;">Episode Not Found</h1>
      <p style="margin-bottom: 24px;">Episode "${episodeId}" (series: ${targetSeries}) is not available.</p>
      <p>Available episodes:</p>
      <ul style="list-style: none; margin-top: 12px; padding: 0;">
        ${availableEpisodeIds
          .map(
            (id) =>
              `<li style="margin: 8px 0;"><a href="?series=${targetSeries}&ep=${id}" style="color: #60a5fa; text-decoration: none; font-size: 1.2rem;">${id} : ${seriesEpisodes[id].metadata.title}</a></li>`
          )
          .join('')}
      </ul>
    </div>
  `;
} else {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
      root.render(
      <StrictMode>
        <StudioApp episode={episode} episodeId={episodeId} seriesId={targetSeries} />
      </StrictMode>
    );
  }
}
