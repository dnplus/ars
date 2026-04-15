import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { resolveLayout } from '../layouts';
import { getScene } from '../scenes';
import { ThemeProvider } from '../shared/ThemeContext';
import type { Episode, Step, LayoutMode } from '../shared/types';

export type SlideCompositionProps = {
  step: Step;
  prevLayoutMode?: LayoutMode;
  episode: Episode;
  episodeInfo: {
    title: string;
    subtitle: string;
    channelName: string;
    decorationText: string;
    episodeTag: string;
  };
  audioSrc?: string;
};

export const SlideComposition: React.FC<SlideCompositionProps> = ({
  step,
  prevLayoutMode,
  episode,
  episodeInfo,
  audioSrc,
}) => {
  const shell = episode.shell!;
  const theme = shell.theme!;
  const Layout = resolveLayout(shell.layout);
  const Scene = getScene(shell.scene);
  const config = {
    ...shell.config,
    subtitle: { ...shell.config.subtitle, enabled: false },
  };

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill>
        <Layout
          config={config}
          decorationText={episodeInfo.decorationText}
          audioSrc={audioSrc ?? 'shared/silence.mp3'}
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
        {audioSrc && !episode.metadata.skipAudio && (
          <Audio src={staticFile(audioSrc)} />
        )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
