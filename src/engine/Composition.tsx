/**
 * @module Composition
 * @description Root Episode Renderer / Assembler
 *
 * @agent-note
 * **Role**: The "Main Loop" of the video.
 * **Flow**:
 * 1. Takes `Episode` data (JSON-like structure).
 * 2. Maps through `episode.steps`.
 * 3. Resolves `Layout` (Shell) and `Scene` (Inner Content) dynamically.
 * 4. Combines them into a Remotion `Sequence` with Audio.
 */

import React from "react";
import { AbsoluteFill, Series, Audio, staticFile } from "remotion";
import { Episode } from "./shared/types";
import { getLayout } from "./layouts";
import { getScene } from "./scenes";
import { BackgroundMusic } from "./components/ui/BackgroundMusic";
import { type SubtitlePhrase } from "./shared/subtitle";
import { StepTransition } from "./shared/effects";
import { ThemeProvider } from "./shared/ThemeContext";
import { ThumbnailCard } from "./components/cards/ThumbnailCard";

export type EpisodeRendererProps = {
  episode: Episode;
  /** 字幕時間戳 mapping (stepId -> SubtitlePhrase[]) */
  subtitles?: Record<string, SubtitlePhrase[]>;
};

export const EpisodeRenderer: React.FC<EpisodeRendererProps> = ({
  episode,
  subtitles,
}) => {
  if (!episode.shell) {
    throw new Error(
      `[EpisodeRenderer] Episode "${episode.metadata.title}" has no shell config. ` +
      `Either add shell to the episode or ensure the series has a series-config.ts with SERIES_CONFIG.shell.`
    );
  }

  const shell = episode.shell;
  const Layout = getLayout(shell.layout);
  const Scene = getScene(shell.scene);
  const totalSteps = episode.steps.length;

  const isShorts = shell.layout === 'shorts';
  const fps = episode.metadata.fps || 30;
  const shortsCoverDuration = 1.5; // seconds

  return (
    <ThemeProvider theme={shell.theme}>
      <AbsoluteFill>
        <Series>
          {/* Shorts: auto-insert 1.5s ThumbnailCard cover */}
          {isShorts && (
            <Series.Sequence key="__shorts-cover" durationInFrames={Math.ceil(shortsCoverDuration * fps)}>
              <ThumbnailCard
                title={episode.metadata.title}
                subtitle={episode.metadata.subtitle}
                channelName={episode.metadata.channelName}
                episodeTag={episode.metadata.episodeTag}
                theme={shell.theme ? {
                  primary: shell.theme.colors.primary,
                  accent: shell.theme.colors.accent,
                  surfaceDark: shell.theme.colors.surfaceDark,
                  onDark: shell.theme.colors.onDark,
                } : undefined}
                mascotUrl={shell.config?.vtuber?.closedImg ? staticFile(shell.config.vtuber.closedImg) : undefined}
                width={episode.metadata.width || 1080}
                height={episode.metadata.height || 1920}
              />
            </Series.Sequence>
          )}
          {episode.steps.map((step, index) => {
            const stepSubtitles = subtitles?.[step.id];
            // 有字幕時，用最後一段 endTime 作為實際音訊長度；否則 fallback 到手動設定
            const actualDuration = stepSubtitles?.length
              ? Math.ceil(stepSubtitles[stepSubtitles.length - 1].endTime)
              : step.durationInSeconds;
            const durationInFrames = actualDuration * (episode.metadata.fps || 30);
            const hasNarration = step.narration && step.narration.trim() !== '';
            const series = episode.metadata.series;
            const epId = episode.metadata.id;
            const audioSrc = hasNarration && series && epId
              ? `episodes/${series}/${epId}/audio/${step.id}.mp3`
              : undefined;

            // 取得前一個 step 的 layoutMode（用於過場動畫）
            const prevStep = index > 0 ? episode.steps[index - 1] : null;
            const prevLayoutMode = prevStep?.layoutMode;
            const currentLayoutMode = step.layoutMode;

            const isFirst = index === 0;
            const isLast = index === totalSteps - 1;

            // skipTransition: 跳過此 step 的 enter/exit 過場（連續 fullscreen 等場景）
            const nextStep = index < totalSteps - 1 ? episode.steps[index + 1] : null;
            const shouldSkipEnter = isFirst || !!step.skipTransition;
            const shouldSkipExit = isLast || !!step.skipTransition || !!nextStep?.skipTransition;

            return (
              <Series.Sequence key={step.id} durationInFrames={durationInFrames}>
                <StepTransition skipEnter={shouldSkipEnter} skipExit={shouldSkipExit}>
                  <Layout
                    config={shell.config}
                    audioSrc={audioSrc}
                    narration={step.narration}
                    subtitles={stepSubtitles}
                    decorationText={episode.metadata.decorationText}
                    layoutMode={currentLayoutMode}
                    prevLayoutMode={prevLayoutMode}
                    backgroundPreset={step.backgroundPreset}
                  >
                    <Scene
                      step={step}
                      episodeTitle={episode.metadata.title}
                      episodeSubtitle={episode.metadata.subtitle}
                      channelName={episode.metadata.channelName}
                      episodeTag={episode.metadata.episodeTag}
                    />
                  </Layout>
                </StepTransition>

                {/* Audio Track - 只在有 narration 時載入 */}
                {!episode.metadata.skipAudio && hasNarration && audioSrc && (
                  <Audio src={staticFile(audioSrc)} />
                )}
              </Series.Sequence>
            );
          })}
        </Series>

        {/* Background Music — 省略 bgm 或 src 為空則不播放 */}
        {!episode.metadata.skipAudio && shell.bgm?.src && (
          <BackgroundMusic
            src={shell.bgm.src}
            volume={shell.bgm.volume ?? 0.05}
          />
        )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
