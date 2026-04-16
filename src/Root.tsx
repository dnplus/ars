/**
 * @module Root
 * @description Remotion Entry Point
 *
 * @agent-note
 * **Role**: Registration Center.
 * **Responsibility**:
 * 1. Uses require.context to auto-scan all series under src/episodes/.
 * 2. Loads series-config.ts for each series (shell + episodeDefaults).
 * 3. Groups each series into a Remotion Folder.
 * 4. Registers each episode as a Composition with ID format: {series}--{epId}.
 * 5. Auto-injects shell + metadata defaults from SeriesConfig.
 */
import "./index.css";
import "./engine/shared/load-local-fonts";
import React from "react";
import { Composition, Folder, Still, staticFile } from "remotion";
import { EpisodeRenderer } from "./engine/Composition";
import { ThumbnailCard } from "./engine/components/cards/ThumbnailCard";
import { getLayoutKey } from "./engine/layouts";
import { ThemePreviewCard } from "./engine/components/ThemePreviewCard";
import { FALLBACK_THEME, ThemeProvider } from "./engine/shared/ThemeContext";
import { Episode, SeriesConfig } from "./engine/shared/types";

// 跨目錄掃描所有 series 下的 .ts 檔案
// 過濾邏輯移至 loop 中以增加相容性 (避免 require.context 的 regex 在某些環境不支援 lookbehind)
const allEpisodeModules: RequireContext = (require as any).context(
  './episodes',
  true,
  /^\.\/[^/]+\/ep[^/]*\.ts$/
);

// 載入各 series 的 series-config.ts（新）+ config.ts（向後相容）
const allSeriesConfigModules: RequireContext = (require as any).context(
  './episodes',
  true,
  /^\.\/[^/]+\/series-config\.ts$/
);

// 向後相容：也載入舊的 config.ts
const allLegacyConfigModules: RequireContext = (require as any).context(
  './episodes',
  true,
  /^\.\/[^/]+\/config\.ts$/
);

// ── 載入 SeriesConfig ──
const seriesConfigs: Record<string, SeriesConfig> = {};
const legacyDefaults: Record<string, Partial<Episode['metadata']>> = {};

// 新版 series-config.ts（優先）
allSeriesConfigModules.keys().forEach((filePath: string) => {
  const match = filePath.match(/^\.\/([^/]+)\/series-config\.ts$/);
  if (!match) return;
  const series = match[1];
  const mod = allSeriesConfigModules(filePath) as Record<string, unknown>;
  if (mod.SERIES_CONFIG) {
    seriesConfigs[series] = mod.SERIES_CONFIG as SeriesConfig;
  }
});

// 舊版 config.ts fallback（只在沒有 series-config.ts 時使用）
allLegacyConfigModules.keys().forEach((filePath: string) => {
  const match = filePath.match(/^\.\/([^/]+)\/config\.ts$/);
  if (!match) return;
  const series = match[1];
  if (seriesConfigs[series]) return; // 新版優先
  const mod = allLegacyConfigModules(filePath) as Record<string, unknown>;
  const defaultsKey = Object.keys(mod).find(k => k.endsWith('_EPISODE_DEFAULTS'));
  if (defaultsKey) legacyDefaults[series] = mod[defaultsKey] as Partial<Episode['metadata']>;
});

// 全局 fallback（當 series config 也沒有時）
const GLOBAL_FALLBACK = { width: 1920, height: 1080, fps: 30 } as const;
const TEMPLATE_SERIES_ID = 'template';

// 建立 seriesMap: Record<series, Record<epId, Episode>>
const seriesMap: Record<string, Record<string, Episode>> = {};

allEpisodeModules.keys().forEach((filePath: string) => {
  // filePath 形如 './demo-series/ep001.ts' 或 './demo-series/ep-pixel-demo.ts'
  const match = filePath.match(/^\.\/([^/]+)\/(ep[^/]+)\.ts$/);
  if (!match) return;
  const [, series, epId] = match;

  if (epId === 'episode' || filePath.includes('.template.') || filePath.includes('.subtitles.')) return;

  const mod = allEpisodeModules(filePath) as Record<string, unknown>;
  const episode = Object.values(mod).find(
    (exp): exp is Episode =>
      typeof exp === 'object' && exp !== null && 'steps' in (exp as Record<string, unknown>)
  ) as Episode | undefined;

  if (episode) {
    if (!seriesMap[series]) seriesMap[series] = {};
    seriesMap[series][epId] = episode;
  }
});

const hasUserSeries = Object.keys(seriesMap).some((series) => series !== TEMPLATE_SERIES_ID);
const visibleSeriesEntries = Object.entries(seriesMap)
  .filter(([series]) => !(hasUserSeries && series === TEMPLATE_SERIES_ID))
  .sort(([left], [right]) => left.localeCompare(right));
const visibleSeriesConfigEntries = Object.entries(seriesConfigs)
  .filter(([series]) => !(hasUserSeries && series === TEMPLATE_SERIES_ID))
  .sort(([left], [right]) => left.localeCompare(right));

export const RemotionRoot: React.FC = () => (
  <>
    {visibleSeriesEntries.map(([series, episodes]) => (
      <Folder key={series} name={series}>
        {Object.entries(episodes).sort().map(([epId, episode]) => {
          const sc = seriesConfigs[series];
          const legacyDef = legacyDefaults[series];

          // 自動注入 shell：ep 自己有 > SeriesConfig > 無（Composition 會 throw）
          const shell = episode.shell ?? sc?.shell;

          // metadata 優先順序：ep 自己寫的 > SeriesConfig.episodeDefaults > legacy defaults > global fallback
          const defaults = sc?.episodeDefaults ?? legacyDef ?? {};
          const enrichedEpisode: Episode = {
            ...episode,
            shell,
            metadata: {
              ...GLOBAL_FALLBACK,
              ...defaults,
              ...episode.metadata,
            },
          };

          const { fps, width, height } = enrichedEpisode.metadata as Required<Pick<Episode['metadata'], 'fps' | 'width' | 'height'>>;
          const subs = episode.subtitles;
          const durationInSeconds = episode.steps.reduce((sum, step) => {
            const stepSubs = subs?.[step.id];
            const stepDuration = stepSubs?.length
              ? Math.ceil(stepSubs[stepSubs.length - 1].endTime)
              : step.durationInSeconds;
            return sum + stepDuration;
          }, 0);
          // Shorts auto-inserts a 1.5s cover in Composition
          const shortsCoverSeconds =
            shell && getLayoutKey(shell.layout) === 'shorts' ? 1.5 : 0;
          const durationInFrames = Math.ceil((durationInSeconds + shortsCoverSeconds) * fps);

          return (
            <Composition
              key={`${series}--${epId}`}
              id={`${series}--${epId}`}
              component={EpisodeRenderer}
              durationInFrames={durationInFrames}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                episode: enrichedEpisode,
                episodeId: epId,
                seriesId: series,
                subtitles: episode.subtitles,
              }}
            />
          );
        })}
      </Folder>
    ))}

    {/* ── Cover Stills ── */}
    <Folder name="covers">
      {visibleSeriesEntries.map(([series, episodes]) => (
        <Folder key={`cover-${series}`} name={series}>
          {Object.entries(episodes).sort().map(([epId, episode]) => {
            const sc = seriesConfigs[series];
            const shell = episode.shell ?? sc?.shell;
            const defaults = sc?.episodeDefaults ?? {};
            const meta = { ...GLOBAL_FALLBACK, ...defaults, ...episode.metadata };
            const w = meta.width ?? 1280;
            const h = meta.height ?? 720;

            const mascotUrl = shell?.config?.vtuber?.openImg
              ? staticFile(shell.config.vtuber.openImg)
              : staticFile(`episodes/${series}/shared/vtuber/vtuber_open.png`);

            const CardComponent = () =>
              (
                <ThumbnailCard
                  title={meta.title}
                  subtitle={meta.subtitle}
                  channelName={meta.channelName}
                  episodeTag={meta.episodeTag}
                  width={w}
                  height={h}
                  mascotUrl={mascotUrl}
                />
              );

            return (
              <Still
                key={`cover-${series}--${epId}`}
                id={`cover-${series}--${epId}`}
                component={CardComponent}
                width={w}
                height={h}
              />
            );
          })}
        </Folder>
      ))}
    </Folder>

    <Folder name="theme-preview">
      {visibleSeriesConfigEntries.map(([seriesId, config]) => (
        <Still
          key={seriesId}
          id={`theme-${seriesId}`}
          component={() => (
            <ThemeProvider theme={config.shell?.theme ?? FALLBACK_THEME}>
              <ThemePreviewCard />
            </ThemeProvider>
          )}
          width={1920}
          height={1080}
        />
      ))}
    </Folder>
  </>
);
