/**
 * @component StudioApp
 * @description ARS Studio — animated preview + review tool using Remotion Player
 */
import React, { useMemo, useRef, useState, useCallback, useEffect, CSSProperties } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Episode, Step } from '../shared/types';
import { useStepNavigation } from './hooks/useStepNavigation';
import { episodeToStudioSteps, getStudioEpisodeInfo } from './adapters/episodeToStudioSteps';
import { ThemeProvider } from '../shared/ThemeContext';
import { ActionBar } from './components/ActionBar';
import { FixListSidebar } from './components/FixListSidebar';
import { StepEditorPanel } from './components/StepEditorPanel';
import { StudioComposition, type StudioCompositionProps } from './StudioComposition';
import { EPISODE_SCOPE_ID } from './constants';

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

export const StudioApp: React.FC<StudioAppProps> = ({ episode }) => {
  const [draftEpisode, setDraftEpisode] = useState(episode);
  const shell = draftEpisode.shell!;
  const theme = shell.theme!;
  const studioSteps = useMemo(() => episodeToStudioSteps(draftEpisode), [draftEpisode]);

  // URL params
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const querySeries = queryParams.get('series')?.trim() || undefined;
  const queryEpId = queryParams.get('ep')?.trim() || undefined;
  const queryStepId = queryParams.get('step')?.trim() || undefined;
  const fallbackSeries = querySeries ?? draftEpisode.metadata.series ?? 'unknown-series';
  const fallbackEpId = queryEpId ?? draftEpisode.metadata.id ?? 'unknown-episode';

  const initialStepIndex = useMemo(
    () => (queryStepId ? studioSteps.findIndex((s) => s.step.id === queryStepId) : -1),
    [queryStepId, studioSteps],
  );

  const episodeInfo = useMemo(() => {
    const info = getStudioEpisodeInfo(draftEpisode);
    return {
      ...info,
      id: info.id ?? fallbackEpId,
      title: info.title || fallbackEpId,
      subtitle: info.subtitle ?? `${fallbackSeries}/${fallbackEpId}`,
      channelName: info.channelName ?? fallbackSeries,
      decorationText: info.decorationText ?? fallbackSeries,
      episodeTag: info.episodeTag ?? `${fallbackSeries}/${fallbackEpId}`,
    };
  }, [draftEpisode, fallbackEpId, fallbackSeries]);

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

  const compositionWidth = draftEpisode.metadata.width ?? 1920;
  const compositionHeight = draftEpisode.metadata.height ?? 1080;
  const fps = draftEpisode.metadata.fps ?? 30;

  const appRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [fixAppliedBanner, setFixAppliedBanner] = useState<FixAppliedEntry | null>(null);
  const [showFixList, setShowFixList] = useState(false);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [audioExists, setAudioExists] = useState<boolean | null>(null);
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

  const { currentIndex, totalSteps, isFullscreen, next, prev, goTo } =
    useStepNavigation({
      totalSteps: studioSteps.length,
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

  const currentStudioStep = studioSteps[currentIndex];
  const prevStudioStep = currentIndex > 0 ? studioSteps[currentIndex - 1] : null;
  const durationInFrames = Math.max(
    1,
    Math.round((currentStudioStep?.step.durationInSeconds ?? 5) * fps),
  );

  const applyDraftStep = useCallback((nextStep: Step) => {
    setDraftEpisode((current) => ({
      ...current,
      steps: current.steps.map((existingStep, index) => (
        index === currentIndex ? nextStep : existingStep
      )),
    }));
  }, [currentIndex]);

  const resetDraftStep = useCallback(() => {
    const originalStep = episode.steps[currentIndex];
    if (!originalStep) {
      return;
    }

    applyDraftStep(originalStep);
  }, [applyDraftStep, currentIndex, episode.steps]);

  const viewportRef = useRef<HTMLDivElement>(null);
  type CanvasOverlay = { scale: number; top: number; left: number; width: number; height: number };
  const [canvasOverlay, setCanvasOverlay] = useState<CanvasOverlay | null>(null);

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
      // rAF: browser must commit the transform before we can measure
      requestAnimationFrame(() => {
        const cr = canvas.getBoundingClientRect();
        const vr = pane.getBoundingClientRect();
        setCanvasOverlay({ scale, top: cr.top - vr.top, left: cr.left - vr.left, width: cr.width, height: cr.height });
      });
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [compositionWidth, compositionHeight, showFixList, showStepEditor]);

  // Check if audio file exists for current slide
  useEffect(() => {
    setAudioExists(null);
    const src = currentStudioStep.audioSrc;
    if (!src) { setAudioExists(false); return; }
    fetch(`/${src}`, { method: 'HEAD' })
      .then((r) => setAudioExists(r.ok))
      .catch(() => setAudioExists(false));
  }, [currentStudioStep.audioSrc]);

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

  if (!currentStudioStep) {
    return (
      <div className="studio-app studio-app-error">
        <p>No steps available</p>
      </div>
    );
  }

  const step = currentStudioStep.step;
  const sourceStep = episode.steps[currentIndex] ?? step;

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
                  component={StudioComposition}
                  inputProps={{
                    step: currentStudioStep.step,
                    prevLayoutMode: prevStudioStep?.step.layoutMode,
                    episode: draftEpisode,
                    episodeInfo,
                    audioSrc: currentStudioStep.audioSrc,
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

            {/* Card ✨ — top-left of canvas (outside scaled canvas, no transform interference) */}
            {canvasOverlay && (
              <div style={{ position: 'absolute', top: canvasOverlay.top + 16 * canvasOverlay.scale, left: canvasOverlay.left + 16 * canvasOverlay.scale, zIndex: 120 }}>
                <ActionBar stepId={step.id} series={fallbackSeries} epId={fallbackEpId} kind="visual" />
              </div>
            )}
          </div>

          {/* Narration bar — between viewport and nav */}
          {step.narration && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px',
              background: 'rgba(16,24,40,0.92)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              flexShrink: 0,
            }}>
              <ActionBar stepId={step.id} series={fallbackSeries} epId={fallbackEpId} kind="content" />
              <div style={{
                flex: 1,
                color: '#ddd',
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                maxHeight: 80, overflowY: 'auto',
              }}>
                {step.narration}
              </div>
            </div>
          )}

          {/* Fix-applied banner */}
          {fixAppliedBanner && (
            <div className="studio-fix-banner" role="status" aria-live="polite">
              <div className="studio-fix-banner-message">
                已修正步驟：{fixAppliedBanner.stepIds.join(', ')} — 重新載入以確認
              </div>
              <button
                className="studio-fix-banner-btn"
                type="button"
                onClick={() => window.location.reload()}
              >
                重新載入
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

          <div className="nav-center">
            {/* Global ✨ — center of nav bar */}
            <ActionBar stepId={EPISODE_SCOPE_ID} series={fallbackSeries} epId={fallbackEpId} kind="other" />
          </div>

          <div className="nav-right" style={{ position: 'relative' }}>
            <button
              className={`nav-btn${showStepEditor ? ' active' : ''}`}
              onClick={() => setShowStepEditor((v) => !v)}
              title="Step 編輯器"
            >
              ✎
            </button>
            <button
              className={`nav-btn${showInfo ? ' active' : ''}`}
              onClick={() => setShowInfo((v) => !v)}
              title="步驟資訊"
            >
              📊
            </button>
            <button
              className="nav-btn"
              onClick={() => setShowFixList((v) => !v)}
              title="修正清單"
            >
              📋
            </button>
            <button
              className="nav-btn"
              onClick={handleToggleFullscreen}
              title="全螢幕（F）"
            >
              ⛶
            </button>

            {showInfo && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                right: 0,
                width: 240,
                background: 'rgba(8,15,29,0.92)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: '12px 14px',
                backdropFilter: 'blur(16px)',
                zIndex: 300,
                fontSize: 12,
                color: '#ccc',
                lineHeight: 1.8,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <div><span style={{ color: '#888' }}>series / ep</span>　{fallbackSeries} / {fallbackEpId}</div>
                <div><span style={{ color: '#888' }}>step</span>　{step.id}</div>
                <div><span style={{ color: '#888' }}>卡片類型</span>　{step.layoutMode ?? '—'}</div>
                <div><span style={{ color: '#888' }}>duration</span>　{step.durationInSeconds ?? 5}s</div>
                <div><span style={{ color: '#888' }}>語音</span>　{audioExists === null ? '…' : audioExists ? '✓ 已生成' : '✗ 未生成'}</div>
                <div><span style={{ color: '#888' }}>口播字數</span>　{step.narration ? `${step.narration.length} 字` : '—'}</div>
              </div>
            )}
          </div>

          <div className="nav-progress-bar">
            <div
              className="nav-progress-fill"
              style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </nav>
        </div>{/* end left column */}

        {/* Right column: fix list sidebar (full height) */}
        {showFixList && (
          <FixListSidebar onClose={() => setShowFixList(false)} />
        )}
        {showStepEditor && sourceStep && (
          <StepEditorPanel
            step={step}
            sourceStep={sourceStep}
            onApply={applyDraftStep}
            onReset={resetDraftStep}
            onClose={() => setShowStepEditor(false)}
          />
        )}
      </div>
    </ThemeProvider>
  );
};

export default StudioApp;
