/**
 * @component SlideView
 * @description Slide / presentation phase of the Studio shell. Same playback
 *              surface as ReviewView (Remotion Player + step navigation) with
 *              the editing chrome removed (no ActionBar, no fix list, no step
 *              editor, no audio generation) and presentation affordances added:
 *              chrome auto-hide, presenter notes + timer, slide overview,
 *              subtitle toggle.
 */
import React, { useMemo, useRef, useState, useCallback, useEffect, CSSProperties } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Episode } from '../../shared/types';
import { useStepNavigation } from '../hooks/useStepNavigation';
import { episodeToStudioSteps, getStudioEpisodeInfo } from '../adapters/episodeToStudioSteps';
import { ThemeProvider } from '../../shared/ThemeContext';
import { StudioComposition, type StudioCompositionProps } from '../StudioComposition';

import '../styles/studio.css';

type SlideViewProps = {
  episode: Episode;
  episodeId: string;
  seriesId: string;
};

const CHROME_IDLE_MS = 3000;
const CHROME_IDLE_MS_FULLSCREEN = 1500;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatClock(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export const SlideView: React.FC<SlideViewProps> = ({ episode, episodeId, seriesId }) => {
  const shell = episode.shell!;
  const theme = shell.theme!;
  const studioSteps = useMemo(
    () => episodeToStudioSteps(episode, seriesId, episodeId),
    [episode, episodeId, seriesId],
  );

  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const queryStepId = queryParams.get('step')?.trim() || undefined;
  const initialStepIndex = useMemo(
    () => (queryStepId ? studioSteps.findIndex((s) => s.step.id === queryStepId) : -1),
    [queryStepId, studioSteps],
  );

  const episodeInfo = useMemo(() => {
    const info = getStudioEpisodeInfo(episode);
    return {
      ...info,
      title: info.title || episodeId,
      subtitle: info.subtitle ?? `${seriesId}/${episodeId}`,
      channelName: info.channelName ?? seriesId,
      brandTag: info.brandTag ?? seriesId,
      episodeTag: info.episodeTag ?? `${seriesId}/${episodeId}`,
    };
  }, [episode, episodeId, seriesId]);

  const themeStyles = useMemo(() => ({
    '--color-primary': theme.colors.primary,
    '--color-secondary': theme.colors.secondary,
    '--color-accent': theme.colors.accent,
    '--color-bg-dark': theme.colors.surfaceDark,
    '--color-overlay-bg': theme.colors.surfaceOverlay,
    '--color-text-inverse': theme.colors.onPrimary,
    '--color-text-on-dark': theme.colors.onDark,
    '--color-text-card': theme.colors.onCard,
    '--color-text-muted': theme.colors.onCardMuted,
    '--color-border': theme.colors.border,
    '--color-border-light': theme.colors.borderLight,
    '--color-card-bg': theme.colors.surfaceCard,
    '--color-card-header-bg': theme.colors.surfaceCardHeader,
    '--color-positive': theme.colors.positive,
    '--color-negative': theme.colors.negative,
    '--color-info': theme.colors.info,
    '--color-warning': theme.colors.warning,
    '--color-highlight': theme.colors.highlight,
    '--font-main': theme.fonts.main,
    '--font-code': theme.fonts.code,
  } as CSSProperties), [theme]);

  const compositionWidth = episode.metadata.width ?? 1920;
  const compositionHeight = episode.metadata.height ?? 1080;
  const fps = episode.metadata.fps ?? 30;

  const appRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);

  const [subtitlesVisible, setSubtitlesVisible] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const [showOverview, setShowOverview] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [timerStart, setTimerStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

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

  const {
    currentIndex,
    totalSteps,
    isFullscreen,
    showNotes,
    toggleNotes,
    next,
    prev,
    goTo,
  } = useStepNavigation({
    totalSteps: studioSteps.length,
    initialIndex: initialStepIndex >= 0 ? initialStepIndex : 0,
    onToggleFullscreen: handleToggleFullscreen,
  });

  const didApplyStepRef = useRef(false);
  useEffect(() => {
    if (!didApplyStepRef.current && initialStepIndex >= 0 && currentIndex !== initialStepIndex) {
      didApplyStepRef.current = true;
      goTo(initialStepIndex);
    } else if (initialStepIndex >= 0) {
      didApplyStepRef.current = true;
    }
  }, [currentIndex, goTo, initialStepIndex]);

  const currentStudioStep = studioSteps[currentIndex];
  const prevStudioStep = currentIndex > 0 ? studioSteps[currentIndex - 1] : null;
  const nextStudioStep = currentIndex < studioSteps.length - 1 ? studioSteps[currentIndex + 1] : null;
  const stepDurationInSeconds = currentStudioStep?.subtitles?.length
    ? Math.ceil(currentStudioStep.subtitles[currentStudioStep.subtitles.length - 1].endTime)
    : (currentStudioStep?.step.durationInSeconds ?? 5);
  const durationInFrames = Math.max(1, Math.round(stepDurationInSeconds * fps));

  // Scale canvas to fit viewport
  useEffect(() => {
    let frame = 0;
    const updateScale = () => {
      const pane = viewportRef.current;
      const canvas = canvasRef.current;
      if (!pane || !canvas) return;
      if (pane.clientWidth <= 0 || pane.clientHeight <= 0) return;
      const scale = Math.min(
        pane.clientWidth / compositionWidth,
        pane.clientHeight / compositionHeight,
      );
      if (!Number.isFinite(scale) || scale <= 0) return;
      canvas.style.transform = `scale(${scale})`;
      setCanvasScale((current) => (Math.abs(current - scale) < 0.001 ? current : scale));
    };

    const scheduleUpdate = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateScale);
    };

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);

    const pane = viewportRef.current;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && pane) {
      observer = new ResizeObserver(scheduleUpdate);
      observer.observe(pane);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      observer?.disconnect();
    };
  }, [compositionWidth, compositionHeight, showNotes, chromeVisible]);

  // Seek to 0 and play on slide change
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(0);
    void player.play();
  }, [currentIndex]);

  // Pause on last frame
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

  // Chrome auto-hide
  const idleTimerRef = useRef<number | null>(null);
  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    const delay = isFullscreen ? CHROME_IDLE_MS_FULLSCREEN : CHROME_IDLE_MS;
    idleTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, delay);
  }, [isFullscreen]);

  const handleActivity = useCallback(() => {
    setChromeVisible(true);
    armIdleTimer();
  }, [armIdleTimer]);

  useEffect(() => {
    armIdleTimer();
    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [armIdleTimer]);

  // Ticking clock for presenter notes (only while panel is open)
  useEffect(() => {
    if (!showNotes) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [showNotes]);

  // Extra keyboard shortcuts: O (overview), S (subtitles), R (reset timer), Escape (close overview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      switch (e.key) {
        case 'o':
        case 'O':
          e.preventDefault();
          setShowOverview((v) => !v);
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setSubtitlesVisible((v) => !v);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          setTimerStart(Date.now());
          break;
        case 'Escape':
          if (showOverview) {
            e.preventDefault();
            setShowOverview(false);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOverview]);

  if (!currentStudioStep) {
    return (
      <div className="studio-app studio-app-error">
        <p>No steps available</p>
      </div>
    );
  }

  const step = currentStudioStep.step;
  const chromeClass = `slide-chrome${chromeVisible ? '' : ' slide-chrome--hidden'}`;

  return (
    <ThemeProvider theme={theme}>
      <div
        ref={appRef}
        className={`studio-app${isFullscreen ? ' fullscreen' : ''}`}
        style={{ ...themeStyles, flexDirection: 'column' }}
        onMouseMove={handleActivity}
        onMouseDown={handleActivity}
      >
        <div className="studio-main-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div ref={viewportRef} className="studio-viewport">
            <div
              className="studio-scale-wrapper"
              style={{
                width: compositionWidth * canvasScale,
                height: compositionHeight * canvasScale,
                flexShrink: 0,
              }}
            >
              <div
                ref={canvasRef}
                className="studio-canvas"
                style={{ width: compositionWidth, height: compositionHeight }}
              >
                <Player
                  ref={playerRef}
                  component={StudioComposition}
                  inputProps={{
                    step: currentStudioStep.step,
                    prevLayoutMode: prevStudioStep?.step.layoutMode,
                    episode,
                    episodeInfo,
                    audioSrc: currentStudioStep.audioSrc,
                    subtitles: subtitlesVisible ? currentStudioStep.subtitles : undefined,
                    disableSubtitles: !subtitlesVisible,
                  } satisfies StudioCompositionProps}
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
              </div>
            </div>
          </div>

          <nav className={`studio-navigation ${chromeClass}`}>
            <div className="nav-left">
              <button
                className="nav-btn"
                onClick={prev}
                disabled={currentIndex === 0}
                title="上一張（←）"
              >
                ←
              </button>
              <span className="nav-progress">
                {currentIndex + 1} / {totalSteps}
              </span>
              <button
                className="nav-btn"
                onClick={next}
                disabled={currentIndex === totalSteps - 1}
                title="下一張（→）"
              >
                →
              </button>
            </div>

            <div className="nav-center" />

            <div className="nav-right" style={{ position: 'relative' }}>
              <button
                className={`nav-btn${showNotes ? ' active' : ''}`}
                onClick={toggleNotes}
                title="Presenter notes（N）"
              >
                📝
              </button>
              <button
                className={`nav-btn${showOverview ? ' active' : ''}`}
                onClick={() => setShowOverview((v) => !v)}
                title="Overview（O）"
              >
                🗂
              </button>
              <button
                className={`nav-btn${subtitlesVisible ? ' active' : ''}`}
                onClick={() => setSubtitlesVisible((v) => !v)}
                title="字幕（S）"
              >
                CC
              </button>
              <button
                className="nav-btn"
                onClick={handleToggleFullscreen}
                title="全螢幕（F）"
              >
                ⛶
              </button>
            </div>

            <div className="nav-progress-bar">
              <div
                className="nav-progress-fill"
                style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </nav>
        </div>

        {showNotes && (
          <div
            style={{
              position: 'fixed',
              right: 16,
              bottom: 96,
              width: 320,
              maxHeight: '60vh',
              background: 'var(--color-overlay-bg)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 12,
              padding: '14px 16px',
              backdropFilter: 'blur(16px)',
              zIndex: 400,
              color: 'var(--color-text-on-dark)',
              fontSize: 13,
              lineHeight: 1.6,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>
                {formatElapsed(now - timerStart)}
              </div>
              <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>
                elapsed
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'color-mix(in srgb, var(--color-text-on-dark) 78%, transparent)' }}>
                {formatClock(new Date(now))}
              </div>
              <button
                type="button"
                onClick={() => setTimerStart(Date.now())}
                title="重置計時（R）"
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border-light)',
                  background: 'transparent',
                  color: 'color-mix(in srgb, var(--color-text-on-dark) 78%, transparent)',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                reset
              </button>
            </div>

            <div
              style={{
                fontSize: 11,
                color: 'color-mix(in srgb, var(--color-text-on-dark) 58%, transparent)',
                borderTop: '1px solid var(--color-border-light)',
                paddingTop: 8,
              }}
            >
              next:{' '}
              <span style={{ color: 'var(--color-text-on-dark)' }}>
                {nextStudioStep
                  ? `${currentIndex + 2}. ${nextStudioStep.step.id}${nextStudioStep.step.layoutMode ? ` · ${nextStudioStep.step.layoutMode}` : ''}`
                  : '（last slide）'}
              </span>
            </div>

            <div
              style={{
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                paddingRight: 4,
                flex: 1,
                minHeight: 0,
              }}
            >
              {step.narration?.trim() || (
                <span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 52%, transparent)' }}>
                  （此張無口播）
                </span>
              )}
            </div>
          </div>
        )}

        {showOverview && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'color-mix(in srgb, var(--color-bg-dark) 94%, transparent)',
              backdropFilter: 'blur(8px)',
              zIndex: 500,
              padding: '32px 40px',
              overflowY: 'auto',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowOverview(false);
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 20,
                color: 'var(--color-text-on-dark)',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                Overview — {totalSteps} slides
              </h2>
              <span style={{ fontSize: 12, color: 'color-mix(in srgb, var(--color-text-on-dark) 58%, transparent)' }}>
                點擊跳轉 · Esc 關閉
              </span>
              <button
                type="button"
                onClick={() => setShowOverview(false)}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-light)',
                  background: 'transparent',
                  color: 'var(--color-text-on-dark)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                關閉
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {studioSteps.map((entry, index) => {
                const isActive = index === currentIndex;
                const narration = entry.step.narration?.trim() ?? '';
                const preview = narration.length > 80 ? `${narration.slice(0, 80)}…` : narration;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      goTo(index);
                      setShowOverview(false);
                    }}
                    style={{
                      textAlign: 'left',
                      background: isActive
                        ? 'color-mix(in srgb, var(--color-primary) 22%, var(--color-overlay-bg))'
                        : 'var(--color-overlay-bg)',
                      border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: 'var(--color-text-on-dark)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      minHeight: 120,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isActive
                            ? 'var(--color-primary)'
                            : 'color-mix(in srgb, var(--color-text-on-dark) 58%, transparent)',
                        }}
                      >
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.step.id}
                      </span>
                      {entry.step.layoutMode && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 10,
                            color: 'color-mix(in srgb, var(--color-text-on-dark) 52%, transparent)',
                          }}
                        >
                          {entry.step.layoutMode}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: 'color-mix(in srgb, var(--color-text-on-dark) 72%, transparent)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {preview || (
                        <span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 40%, transparent)' }}>
                          （無口播）
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
};

export default SlideView;
