/**
 * @component ReviewView
 * @description Review phase of the Studio shell — animated preview + review tool
 *              using Remotion Player. Previously known as StudioApp; renamed
 *              when the Studio shell was introduced and review became one of
 *              several phases (plan / build / review).
 */
import React, { useMemo, useRef, useState, useCallback, useEffect, CSSProperties } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Episode, Step } from '../../shared/types';
import { useStepNavigation } from '../hooks/useStepNavigation';
import { episodeToStudioSteps, getStudioEpisodeInfo } from '../adapters/episodeToStudioSteps';
import { ThemeProvider } from '../../shared/ThemeContext';
import { ActionBar } from '../components/ActionBar';
import { FixListSidebar } from '../components/FixListSidebar';
import { StepEditorPanel } from '../components/StepEditorPanel';
import { StudioComposition, type StudioCompositionProps } from '../StudioComposition';
import { EPISODE_SCOPE_ID } from '../constants';

import '../styles/studio.css';

type ReviewViewProps = {
  episode: Episode;
  episodeId: string;
  seriesId: string;
};

type FixAppliedEntry = {
  timestamp: string;
  stepIds: string[];
};

type FixAppliedResponse = {
  ok: boolean;
  latest: FixAppliedEntry | null;
};

type AudioJobState = {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  series?: string;
  epId?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  exitCode?: number | null;
  outputTail?: string[];
};

type AudioJobResponse = {
  ok: boolean;
  job?: AudioJobState;
  error?: string;
};

type AudioCapability = {
  visible: boolean;
  enabled: boolean;
  reason?: string;
};

type AudioCapabilityResponse = {
  ok: boolean;
  capability?: AudioCapability;
  error?: string;
};

type EpisodeSourceMap = {
  filePath: string;
  stepLines: Record<string, number>;
};

type EpisodeSourceMapResponse = {
  ok: boolean;
  sourceMap?: EpisodeSourceMap;
  error?: string;
};

export const ReviewView: React.FC<ReviewViewProps> = ({ episode, episodeId, seriesId }) => {
  const [draftEpisode, setDraftEpisode] = useState(episode);
  const shell = draftEpisode.shell!;
  const theme = shell.theme!;
  const studioSteps = useMemo(
    () => episodeToStudioSteps(draftEpisode, seriesId, episodeId),
    [draftEpisode, episodeId, seriesId],
  );

  // URL params
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const querySeries = queryParams.get('series')?.trim() || undefined;
  const queryEpId = queryParams.get('ep')?.trim() || undefined;
  const queryStepId = queryParams.get('step')?.trim() || undefined;
  const fallbackSeries = querySeries ?? seriesId;
  const fallbackEpId = queryEpId ?? episodeId;

  const initialStepIndex = useMemo(
    () => (queryStepId ? studioSteps.findIndex((s) => s.step.id === queryStepId) : -1),
    [queryStepId, studioSteps],
  );

  const episodeInfo = useMemo(() => {
    const info = getStudioEpisodeInfo(draftEpisode);
    return {
      ...info,
      title: info.title || fallbackEpId,
      subtitle: info.subtitle ?? `${fallbackSeries}/${fallbackEpId}`,
      channelName: info.channelName ?? fallbackSeries,
      brandTag: info.brandTag ?? fallbackSeries,
      episodeTag: info.episodeTag ?? `${fallbackSeries}/${fallbackEpId}`,
    };
  }, [draftEpisode, fallbackEpId, fallbackSeries]);

  // CSS variables from theme
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
  const [audioJob, setAudioJob] = useState<AudioJobState>({ status: 'idle' });
  const [episodeSourceMap, setEpisodeSourceMap] = useState<EpisodeSourceMap | null>(null);
  const [audioCapability, setAudioCapability] = useState<AudioCapability>({
    visible: false,
    enabled: false,
  });
  const latestFixTimestampRef = useRef<string | null>(null);
  const fixInitializedRef = useRef(false);

  const pollAudioJob = useCallback(async () => {
    try {
      const res = await fetch('/__ars/audio-generate');
      if (!res.ok) return;
      const payload = (await res.json()) as AudioJobResponse;
      if (payload.job) {
        setAudioJob(payload.job);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleGenerateFullAudio = useCallback(async () => {
    try {
      const res = await fetch('/__ars/audio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series: fallbackSeries, epId: fallbackEpId }),
      });
      const payload = (await res.json()) as AudioJobResponse;
      if (!res.ok || !payload.job) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setAudioJob(payload.job);
    } catch (error) {
      setAudioJob({
        status: 'failed',
        series: fallbackSeries,
        epId: fallbackEpId,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outputTail: [error instanceof Error ? error.message : String(error)],
      });
    }
  }, [fallbackEpId, fallbackSeries]);

  const loadAudioCapability = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('series', fallbackSeries);
      const res = await fetch(`/__ars/audio-capability?${params.toString()}`);
      const payload = (await res.json()) as AudioCapabilityResponse;
      if (!res.ok || !payload.capability) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setAudioCapability(payload.capability);
    } catch (error) {
      setAudioCapability({
        visible: true,
        enabled: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }, [fallbackSeries]);

  const loadEpisodeSourceMap = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('series', fallbackSeries);
      params.set('ep', fallbackEpId);
      const res = await fetch(`/__ars/episode-source-map?${params.toString()}`);
      const payload = (await res.json()) as EpisodeSourceMapResponse;
      if (!res.ok || !payload.sourceMap) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setEpisodeSourceMap(payload.sourceMap);
    } catch {
      setEpisodeSourceMap(null);
    }
  }, [fallbackEpId, fallbackSeries]);

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
  const stepDurationInSeconds = currentStudioStep?.subtitles?.length
    ? Math.ceil(currentStudioStep.subtitles[currentStudioStep.subtitles.length - 1].endTime)
    : (currentStudioStep?.step.durationInSeconds ?? 5);
  const durationInFrames = Math.max(1, Math.round(stepDurationInSeconds * fps));

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
  }, [currentStudioStep.audioSrc, audioJob.status, audioJob.finishedAt]);

  useEffect(() => {
    void loadAudioCapability();
  }, [loadAudioCapability]);

  useEffect(() => {
    void loadEpisodeSourceMap();
  }, [loadEpisodeSourceMap]);

  useEffect(() => {
    void pollAudioJob();
    if (audioJob.status !== 'running') {
      return;
    }

    const timer = window.setInterval(() => void pollAudioJob(), 2000);
    return () => window.clearInterval(timer);
  }, [audioJob.status, pollAudioJob]);

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
  const audioButtonLabel =
    audioJob.status === 'running'
      ? '🔊 生成中…'
      : audioJob.status === 'succeeded'
        ? '🔊 已生成'
        : audioJob.status === 'failed'
          ? '🔊 重試音訊'
          : '🔊 生成音訊';
  const audioButtonTitle =
    audioJob.status === 'running'
      ? '正在背景生成整集語音'
      : audioCapability.enabled
        ? '為整集生成語音與字幕'
        : (audioCapability.reason ?? '目前無法生成音訊');

  return (
    <ThemeProvider theme={theme}>
      <div
        ref={appRef}
        className={`studio-app${isFullscreen ? ' fullscreen' : ''}`}
        style={{ ...themeStyles, flexDirection: 'row' }}
      >
        {/* Left column: viewport + nav */}
        <div className="studio-main-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                    subtitles: currentStudioStep.subtitles,
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
                <ActionBar anchor={{ type: 'step', id: step.id }} source="review" series={fallbackSeries} epId={fallbackEpId} kind="visual" />
              </div>
            )}
          </div>

          {/* Narration bar — between viewport and nav */}
          {step.narration && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px',
              background: 'var(--color-overlay-bg)',
              borderTop: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              flexShrink: 0,
            }}>
              <ActionBar anchor={{ type: 'step', id: step.id }} source="review" series={fallbackSeries} epId={fallbackEpId} kind="content" />
              <div style={{
                flex: 1,
                color: 'var(--color-text-on-dark)',
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
            <ActionBar anchor={{ type: 'episode', id: EPISODE_SCOPE_ID }} source="review" series={fallbackSeries} epId={fallbackEpId} kind="other" />
          </div>

          <div className="nav-right" style={{ position: 'relative' }}>
            {audioCapability.visible && (
              <button
                className={`nav-btn${audioJob.status === 'running' ? ' active' : ''}`}
                onClick={() => void handleGenerateFullAudio()}
                disabled={audioJob.status === 'running' || !audioCapability.enabled}
                title={audioButtonTitle}
              >
                {audioButtonLabel}
              </button>
            )}
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
                background: 'var(--color-overlay-bg)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 12,
                padding: '12px 14px',
                backdropFilter: 'blur(16px)',
                zIndex: 300,
                fontSize: 12,
                color: 'var(--color-text-on-dark)',
                lineHeight: 1.8,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>series / ep</span>　{fallbackSeries} / {fallbackEpId}</div>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>step</span>　{step.id}</div>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>卡片類型</span>　{step.layoutMode ?? '—'}</div>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>duration</span>　{stepDurationInSeconds}s</div>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>語音</span>　{audioExists === null ? '…' : audioExists ? '✓ 已生成' : '✗ 未生成'}</div>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>audio capability</span>　{audioCapability.visible ? (audioCapability.enabled ? 'enabled' : 'disabled') : 'hidden'}</div>
                {audioCapability.reason && (
                  <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>audio reason</span>　{audioCapability.reason}</div>
                )}
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>audio job</span>　{audioJob.status}</div>
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>口播字數</span>　{step.narration ? `${step.narration.length} 字` : '—'}</div>
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
            sourceFilePath={episodeSourceMap?.filePath}
            sourceStartLine={episodeSourceMap?.stepLines?.[step.id]}
            onApply={applyDraftStep}
            onReset={resetDraftStep}
            onClose={() => setShowStepEditor(false)}
          />
        )}
      </div>
    </ThemeProvider>
  );
};

export default ReviewView;
