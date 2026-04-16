import React from "react";
import { Audio, staticFile } from "remotion";
import { resolveLayout } from "../layouts";
import { CaCScene } from "../scenes";
import type { Episode, LayoutMode, Step } from "../shared/types";
import type { SubtitlePhrase } from "../shared/subtitle";

export type EpisodeInfo = {
  title: string;
  subtitle?: string;
  channelName?: string;
  decorationText?: string;
  episodeTag?: string;
};

export type StepRendererProps = {
  episode: Episode;
  step: Step;
  episodeInfo: EpisodeInfo;
  prevLayoutMode?: LayoutMode;
  audioSrc?: string;
  subtitles?: SubtitlePhrase[];
  disableSubtitles?: boolean;
  silentAudioFallback?: string;
};

export const StepRenderer: React.FC<StepRendererProps> = ({
  episode,
  step,
  episodeInfo,
  prevLayoutMode,
  audioSrc,
  subtitles,
  disableSubtitles = false,
  silentAudioFallback,
}) => {
  const shell = episode.shell!;
  const Layout = resolveLayout(shell.layout);
  const Scene = CaCScene;
  const config = disableSubtitles
    ? {
        ...shell.config,
        subtitle: { ...shell.config.subtitle, enabled: false },
      }
    : shell.config;

  return (
    <>
      <Layout
        config={config}
        decorationText={episodeInfo.decorationText}
        audioSrc={audioSrc ?? silentAudioFallback}
        narration={step.narration}
        subtitles={subtitles}
        layoutMode={step.layoutMode}
        prevLayoutMode={prevLayoutMode}
        backgroundPreset={step.backgroundPreset}
      >
        <Scene
          step={step}
          episodeTitle={episodeInfo.title}
          episodeSubtitle={episodeInfo.subtitle}
          channelName={episodeInfo.channelName}
          episodeTag={episodeInfo.episodeTag}
        />
      </Layout>
      {audioSrc && !episode.metadata.skipAudio ? (
        <Audio src={staticFile(audioSrc)} />
      ) : null}
    </>
  );
};

export default StepRenderer;
