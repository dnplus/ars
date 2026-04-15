import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ThemeProvider } from '../shared/ThemeContext';
import type { Episode, Step, LayoutMode } from '../shared/types';
import { StepRenderer, type EpisodeInfo } from '../renderers/StepRenderer';

export type StudioCompositionProps = {
  step: Step;
  prevLayoutMode?: LayoutMode;
  episode: Episode;
  episodeInfo: EpisodeInfo;
  audioSrc?: string;
};

export const StudioComposition: React.FC<StudioCompositionProps> = ({
  step,
  prevLayoutMode,
  episode,
  episodeInfo,
  audioSrc,
}) => {
  const shell = episode.shell!;
  const theme = shell.theme!;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill>
        <StepRenderer
          episode={episode}
          step={step}
          episodeInfo={episodeInfo}
          prevLayoutMode={prevLayoutMode}
          audioSrc={audioSrc}
          disableSubtitles
          silentAudioFallback="shared/silence.mp3"
        />
      </AbsoluteFill>
    </ThemeProvider>
  );
};
