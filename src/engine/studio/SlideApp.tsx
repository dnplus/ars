/**
 * @component StudioApp
 * @description ARS Studio — animated preview + review tool using Remotion Player
 */
import React, { useMemo, useRef, useState, useCallback, useEffect, CSSProperties } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Episode } from '../shared/types';
import { useSlideNavigation } from './hooks/useSlideNavigation';
import { episodeToSlides, getEpisodeInfo } from './adapters/episodeToSlides';
import { ThemeProvider } from '../shared/ThemeContext';
import { ActionBar } from './components/ActionBar';
import { FixListSidebar } from './components/FixListSidebar';
import { SlideComposition, type SlideCompositionProps } from './SlideComposition';

import './styles/studio.css';

type StudioAppProps = {
  episode: Episode;
};

type FixAppliedEntry = {
  timestamp: string;
  stepIds: string[];
};

type FixAppliedResponse = {
  ok: boolean;
  latest: FixAppliedEntry | null;
};

export const SlideApp: React.FC<StudioAppProps> = ({ episode }) => {
  const shell = episode.shell!;
  const theme = shell.theme!;
  const slides = useMemo(() => episodeToSlides(episode), [episode]);

  // URL params
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const querySeries = queryParams.get('series')?.trim() || undefined;
  const queryEpId = queryParams.get('ep')?.trim() || undefined;
  const queryStepId = queryParams.get('step')?.trim() || undefined;
  const fallbackSeries = querySeries ?? episode.metadata.series ?? 'unknown-series';
  const fallbackEpId = queryEpId ?? episode.metadata.id ?? 'unknown-episode';

  const initialStepIndex = useMemo(
    () => (queryStepId ? slides.findIndex((s) => s.step.id === queryStepId) : -1),
    [queryStepId, slides],
  );

  const episodeInfo = useMemo(() => {
    const info = getEpisodeInfo(episode);
    return {
      ...info,
      id: info.id ?? fallbackEpId,
      title: info.title || fallbackEpId,
      subtitle: info.subtitle ?? `${fallbackSeries}/${fallbackEpId}`,
      channelName: info.channelName ?? fallbackSeries,
      decorationText: info.decorationText ?? fallbackSeries,
      episodeTag: info.episodeTag ?? `${fallbackSeries}/${fallbackEpId}`,
    };
  }, [episode, fallbackEpId, fallbackSeries]);

  // CSS variables from theme
  const themeStyles = useMemo(() => ({
    '--color-primary': theme.colors.primary,
    '--color-bg-dark': theme.colors.surfaceDark,
    '--color-text-inverse': theme.colors.onPrimary,
    '--color-text-muted': theme.colors.onCardMuted,
    '--color-border': theme.colors.border,
    '--color-card-bg': theme.colors.surfaceCard,
    '--color-card-header-bg': theme.colors.surfaceCardHeader,
    '--font-main': theme.fonts.main,
    '--font-code': theme.fonts.code,
  } as CSSProperties), [theme]);

  const compositionWidth = episode.metadata.width ?? 1920;
  const compositionHeight = episode.metadata.height ?? 1080;
  const fps = episode.metadata.fps ?? 30;

  const appRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [fixAppliedBanner, setFixAppliedBanner] = useState<FixAppliedEntry | null>(null);
  const [showFixList, setShowFixList] = useState(false);
  const latestFixTimestampRef = useRef<string | null>(null);
  const fixInitializedRef = useRef(false);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await appRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  }, []);

  const { currentIndex, totalSlides, isFullscreen, next, prev, goTo } =
    useSlideNavigation({
      totalSlides: slides.length,
      initialIndex: initialStepIndex >= 0 ? initialStepIndex : 0,
      onToggleFullscreen: handleToggleFullscreen,
    });

  // Apply ?step= query param once
  const didApplyStepRef = useRef(false);
  useEffect(() => {
    if (!didApplyStepRef.current && initialStepIndex >= 0 && currentIndex !== initialStepIndex) {
      didApplyStepRef.current = true;
      goTo(initialStepIndex);
    } else if (initialStepIndex >= 0) {
      didApplyStepRef.current = true;
    }
  }, [currentIndex, goTo, initialStepIndex]);

  const currentSlide = slides[currentIndex];
  const prevSlide = currentIndex > 0 ? slides[currentIndex - 1] : null;
  const durationInFrames = Math.max(
    1,
    Math.round((currentSlide?.step.durationInSeconds ?? 5) * fps),
  );

  const viewportRef = useRef<HTMLDivElement>(null);

  // Scale canvas to fit the left pane (sidebar-aware via flex)
  useEffect(() => {
    const updateScale = () => {
      const pane = viewportRef.current;
      const canvas = canvasRef.current;
      if (!pane || !canvas) return;
      const scale = Math.min(
        pane.clientWidth / compositionWidth,
        pane.clientHeight / compositionHeight,
      );
      canvas.style.transform = `scale(${scale})`;
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [compositionWidth, compositionHeight, showFixList]);

  // On slide change: seek to 0 and play
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(0);
    void player.play();
  }, [currentIndex]);

  // Pause on last frame when animation ends
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const lastFrame = durationInFrames - 1;
    const handleEnded = () => {
      player.removeEventListener('ended', handleEnded);
      player.pause();
      player.seekTo(lastFrame);
    };
    player.addEventListener('ended', handleEnded);
    return () => player.removeEventListener('ended', handleEnded);
  }, [currentIndex, durationInFrames]);

  // Poll fix-applied endpoint
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/__ars/fix-applied');
        if (!res.ok) return;
        const payload = (await res.json()) as FixAppliedResponse;
        const latest = payload.latest;
        if (!latest) return;
        if (!fixInitializedRef.current) {
          latestFixTimestampRef.current = latest.timestamp;
          fixInitializedRef.current = true;
          return;
        }
        if (latestFixTimestampRef.current === latest.timestamp) return;
        latestFixTimestampRef.current = latest.timestamp;
        if (!cancelled) setFixAppliedBanner(latest);
      } catch {
        // ignore
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!currentSlide) {
    return (
      <div className="studio-app studio-app-error">
        <p>No slides available</p>
      </div>
    );
  }

  const step = currentSlide.step;

  return (
    <ThemeProvider theme={theme}>
      <div
        ref={appRef}
        className={`studio-app${isFullscreen ? ' fullscreen' : ''}`}
        style={{ ...themeStyles, flexDirection: 'row' }}
      >
        {/* Left column: viewport + nav */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Viewport */}
          <div
            ref={viewportRef}
            className="studio-viewport"
          >
            <div className="studio-scale-wrapper">
              <div
                ref={canvasRef}
                className="studio-canvas"
                style={{ width: compositionWidth, height: compositionHeight }}
              >
                <Player
                  ref={playerRef}
                  component={SlideComposition}
                  inputProps={{
                    step: currentSlide.step,
                    prevLayoutMode: prevSlide?.step.layoutMode,
                    episode,
                    episodeInfo,
                    audioSrc: currentSlide.audioSrc,
                  } satisfies SlideCompositionProps}
                  durationInFrames={durationInFrames}
                  compositionWidth={compositionWidth}
                  compositionHeight={compositionHeight}
                  fps={fps}
                  controls={false}
                  loop={false}
                  autoPlay
                  clickToPlay={false}
                  moveToBeginningWhenEnded={false}
                  initialFrame={0}
                  acknowledgeRemotionLicense
                  style={{ width: compositionWidth, height: compositionHeight }}
                />

                {/* Card ⚡ — bottom-right of canvas */}
                <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 120 }}>
                  <ActionBar stepId={step.id} series={fallbackSeries} epId={fallbackEpId} kind="visual" />
                </div>

                {/* Narration + narration ⚡ — bottom center of canvas */}
                {step.narration && (
                  <div style={{
                    position: 'absolute', bottom: 16, left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'flex-end', gap: 8,
                    maxWidth: '70%', zIndex: 120,
                  }}>
                    <div style={{
                      flex: 1, padding: '10px 16px',
                      background: 'rgba(0,0,0,0.82)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, color: '#fff',
                      fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>
                      {step.narration}
                    </div>
                    <ActionBar stepId={step.id} series={fallbackSeries} epId={fallbackEpId} kind="content" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fix-applied banner */}
          {fixAppliedBanner && (
            <div className="studio-fix-banner" role="status" aria-live="polite">
              <div className="studio-fix-banner-message">
                Steps fixed: {fixAppliedBanner.stepIds.join(', ')} — reload to confirm
              </div>
              <button
                className="studio-fix-banner-btn"
                type="button"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className="studio-navigation">
          <div className="nav-left">
            <button
              className="nav-btn"
              onClick={prev}
              disabled={currentIndex === 0}
              title="Previous (←)"
            >
              ←
            </button>
            <span className="nav-progress">
              {currentIndex + 1} / {totalSlides}
            </span>
            <button
              className="nav-btn"
              onClick={next}
              disabled={currentIndex === totalSlides - 1}
              title="Next (→)"
            >
              →
            </button>
          </div>

          <div className="nav-center" />

          <div className="nav-right">
            {/* Global ⚡ — in nav bar */}
            <ActionBar stepId={step.id} series={fallbackSeries} epId={fallbackEpId} kind="other" />
            <button
              className="nav-btn"
              onClick={() => setShowFixList((v) => !v)}
              title="Toggle Fix List"
            >
              📋
            </button>
            <button
              className="nav-btn"
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? '⬜' : '⬛'}
            </button>
          </div>

          <div className="nav-progress-bar">
            <div
              className="nav-progress-fill"
              style={{ width: `${((currentIndex + 1) / totalSlides) * 100}%` }}
            />
          </div>
        </nav>
        </div>{/* end left column */}

        {/* Right column: fix list sidebar (full height) */}
        {showFixList && (
          <FixListSidebar onClose={() => setShowFixList(false)} />
        )}
      </div>
    </ThemeProvider>
  );
};

export default SlideApp;
