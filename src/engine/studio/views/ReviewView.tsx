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
import { FixListSidebar } from '../components/FixListSidebar';
import { StepEditorPanel } from '../components/StepEditorPanel';
import { PinLayer, type CommittedPin } from '../components/PinLayer';
import { StatusBar, type StatusBarState } from '../components/StatusBar';
import { SelectMode } from '../components/SelectMode';
import { AudioRunner } from '../components/AudioRunner';
import { PrepareRunner } from '../components/PrepareRunner';
import { PublishRunner } from '../components/PublishRunner';
import { StudioComposition, type StudioCompositionProps } from '../StudioComposition';
import { INTENT_SUBMITTED_EVENT } from '../constants';
import type { ReviewIntent } from '../../../types/review-intent';

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

type PublishCapability = {
  visible: boolean;
  enabled: boolean;
  reason?: string;
};

type AudioCapabilityResponse = {
  ok: boolean;
  capability?: AudioCapability;
  error?: string;
};

type PublishCapabilityResponse = {
  ok: boolean;
  capability?: PublishCapability;
  error?: string;
};

type OnboardStatus = {
  active: boolean;
  stage?: 'onboard-walkthrough' | 'onboard-customize' | 'onboard-verify';
  phaseLabel?: string;
  sessionActive: boolean;
  sessionLastSeenAt?: string;
  sessionEndedAt?: string;
  pendingIntents: number;
  previewFingerprint: string;
};

type OnboardStatusResponse = {
  ok: boolean;
  status?: OnboardStatus;
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

export const ReviewView: React.FC<ReviewViewProps> = ({
  episode,
  episodeId,
  seriesId,
}) => {
  const [draftEpisode, setDraftEpisode] = useState(episode);
  const [intents, setIntents] = useState<ReviewIntent[]>([]);
  const [statusState, setStatusState] = useState<StatusBarState>('polling');
  const [statusDetail, setStatusDetail] = useState<string>('polling .ars/studio-intents · idle');
  const [selectModeActive, setSelectModeActive] = useState(false);
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
  const [autoPlayAll, setAutoPlayAll] = useState(false);
  const [audioExists, setAudioExists] = useState<boolean | null>(null);
  const [audioJob, setAudioJob] = useState<AudioJobState>({ status: 'idle' });
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [prepareModalOpen, setPrepareModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [episodeSourceMap, setEpisodeSourceMap] = useState<EpisodeSourceMap | null>(null);
  const [audioCapability, setAudioCapability] = useState<AudioCapability>({
    visible: false,
    enabled: false,
  });
  const [publishCapability, setPublishCapability] = useState<PublishCapability>({
    visible: false,
    enabled: false,
  });
  const [onboardStatus, setOnboardStatus] = useState<OnboardStatus>({
    active: false,
    sessionActive: false,
    pendingIntents: 0,
    previewFingerprint: '',
  });
  const [onboardRefreshPending, setOnboardRefreshPending] = useState(false);
  const latestFixTimestampRef = useRef<string | null>(null);
  const fixInitializedRef = useRef(false);
  const onboardFingerprintRef = useRef<string | null>(null);
  const onboardReloadingRef = useRef(false);

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

  const loadPublishCapability = useCallback(async () => {
    try {
      const res = await fetch('/__ars/publish-capability');
      const payload = (await res.json()) as PublishCapabilityResponse;
      if (!res.ok || !payload.capability) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setPublishCapability(payload.capability);
    } catch (error) {
      setPublishCapability({
        visible: false,
        enabled: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const syncOnboardSession = useCallback(async (event: 'open' | 'heartbeat' | 'close') => {
    try {
      await fetch('/__ars/onboard-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          series: fallbackSeries,
          epId: fallbackEpId,
        }),
        keepalive: event === 'close',
      });
    } catch {
      // ignore transient session-sync failures
    }
  }, [fallbackEpId, fallbackSeries]);

  const loadOnboardStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('series', fallbackSeries);
      params.set('ep', fallbackEpId);
      const res = await fetch(`/__ars/onboard-status?${params.toString()}`);
      const payload = (await res.json()) as OnboardStatusResponse;
      if (!res.ok || !payload.status) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      const nextStatus = payload.status;
      setOnboardStatus(nextStatus);

      if (!nextStatus.active) {
        onboardFingerprintRef.current = nextStatus.previewFingerprint || null;
        onboardReloadingRef.current = false;
        setOnboardRefreshPending(false);
        return;
      }

      const previousFingerprint = onboardFingerprintRef.current;
      const nextFingerprint = nextStatus.previewFingerprint;
      if (!previousFingerprint) {
        onboardFingerprintRef.current = nextFingerprint;
        return;
      }

      if (nextFingerprint && previousFingerprint !== nextFingerprint && !onboardReloadingRef.current) {
        onboardFingerprintRef.current = nextFingerprint;
        if (showStepEditor || selectModeActive) {
          setOnboardRefreshPending(true);
          return;
        }

        onboardReloadingRef.current = true;
        setStatusState('applying');
        setStatusDetail('series preview updated · reloading');
        window.setTimeout(() => window.location.reload(), 250);
        return;
      }

      onboardFingerprintRef.current = nextFingerprint;
    } catch {
      setOnboardStatus({
        active: false,
        sessionActive: false,
        pendingIntents: 0,
        previewFingerprint: '',
      });
      onboardFingerprintRef.current = null;
      onboardReloadingRef.current = false;
    }
  }, [fallbackEpId, fallbackSeries, selectModeActive, showStepEditor]);

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

  const toggleAutoPlayAll = useCallback(() => {
    setAutoPlayAll((enabled) => {
      const nextEnabled = !enabled;
      const player = playerRef.current;
      if (nextEnabled) {
        if (currentIndex === totalSteps - 1) {
          player?.seekTo(0);
        }
        void player?.play();
      } else {
        player?.pause();
      }
      return nextEnabled;
    });
  }, [currentIndex, totalSteps]);

  const pauseAutoPlayForComment = useCallback(() => {
    setAutoPlayAll(false);
    playerRef.current?.pause();
    setSelectModeActive((active) => !active);
  }, []);

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

  // Poll /__ars/studio-intents to derive per-step pins + pending badge count.
  // Overlap with FixListSidebar's own poll is intentional — both views need
  // fresh intents and cross-tab server state is cheap.
  const fetchIntents = useCallback(async () => {
    try {
      const res = await fetch('/__ars/studio-intents');
      if (!res.ok) return;
      const payload = (await res.json()) as { ok: boolean; intents: ReviewIntent[] };
      if (payload.ok) setIntents(payload.intents);
    } catch {
      // transient — try again next tick
    }
  }, []);

  useEffect(() => {
    void fetchIntents();
    const timer = window.setInterval(() => void fetchIntents(), 4000);
    const onSubmitted = () => void fetchIntents();
    window.addEventListener(INTENT_SUBMITTED_EVENT, onSubmitted);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(INTENT_SUBMITTED_EVENT, onSubmitted);
    };
  }, [fetchIntents]);

  // Derive StatusBar state from active signals. Priority:
  //   failed > applying > building (audio job) > ready > onboard > polling
  useEffect(() => {
    if (audioJob.status === 'failed') {
      setStatusState('failed');
      setStatusDetail('audio job failed — see TUI log');
      return;
    }
    if (audioJob.status === 'running') {
      setStatusState('building');
      setStatusDetail('synthesizing narration · background job');
      return;
    }
    if (audioJob.status === 'succeeded') {
      setStatusState('ready');
      setStatusDetail('narration ready · review when idle');
      return;
    }
    if (onboardStatus.active) {
      setStatusState('onboard');
      const modeHint = onboardStatus.stage === 'onboard-customize'
        ? 'series defaults'
        : onboardStatus.stage === 'onboard-walkthrough'
          ? 'demo walkthrough'
          : 'readiness check';
      setStatusDetail(
        `onboard ${onboardStatus.phaseLabel?.toLowerCase() ?? 'active'} · ${
          onboardStatus.sessionActive ? 'Studio connected' : 'Studio reconnecting'
        } · ${modeHint} · ${onboardStatus.pendingIntents} pending`,
      );
      return;
    }
    setStatusState('polling');
    setStatusDetail('polling .ars/studio-intents · idle');
  }, [
    audioJob.status,
    onboardStatus.active,
    onboardStatus.pendingIntents,
    onboardStatus.phaseLabel,
    onboardStatus.sessionActive,
    onboardStatus.stage,
  ]);

  // Applying flash: whenever a new fix-applied banner arrives, flip to
  // 'applying' for ~2s so the user sees Claude Code acting.
  useEffect(() => {
    if (!fixAppliedBanner) return;
    setStatusState('applying');
    setStatusDetail(`已套用 ${fixAppliedBanner.stepIds.length} 筆 fix · ${new Date(fixAppliedBanner.timestamp).toLocaleTimeString()}`);
    const t = window.setTimeout(() => {
      setStatusState('ready');
      setStatusDetail('fixes applied · reload to refresh');
    }, 2500);
    return () => window.clearTimeout(t);
  }, [fixAppliedBanner]);

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
    void loadPublishCapability();
  }, [loadPublishCapability]);

  useEffect(() => {
    void loadOnboardStatus();
    const timer = window.setInterval(() => void loadOnboardStatus(), 3000);
    return () => window.clearInterval(timer);
  }, [loadOnboardStatus]);

  useEffect(() => {
    if (!onboardStatus.active) {
      return;
    }

    void syncOnboardSession('open');
    const timer = window.setInterval(() => void syncOnboardSession('heartbeat'), 3000);
    const closeSession = () => {
      void fetch('/__ars/onboard-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'close',
          series: fallbackSeries,
          epId: fallbackEpId,
        }),
        keepalive: true,
      });
    };

    window.addEventListener('pagehide', closeSession);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', closeSession);
      void syncOnboardSession('close');
    };
  }, [fallbackEpId, fallbackSeries, onboardStatus.active, syncOnboardSession]);

  useEffect(() => {
    if (!onboardRefreshPending || !onboardStatus.active) {
      return;
    }
    if (showStepEditor || selectModeActive || onboardReloadingRef.current) {
      return;
    }

    onboardReloadingRef.current = true;
    setStatusState('applying');
    setStatusDetail('series preview updated · reloading');
    const timer = window.setTimeout(() => window.location.reload(), 250);
    return () => window.clearTimeout(timer);
  }, [onboardRefreshPending, onboardStatus.active, selectModeActive, showStepEditor]);

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

  // Auto-play can walk the episode step-by-step; otherwise leave the player
  // paused where Remotion ended it. Avoid seekTo() here: seeking to the final
  // frame from an `ended` handler re-dispatches `ended` in the Player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const handleEnded = () => {
      if (autoPlayAll && currentIndex < totalSteps - 1) {
        next();
        return;
      }

      player.pause();
      if (autoPlayAll) {
        setAutoPlayAll(false);
      }
    };
    player.addEventListener('ended', handleEnded);
    return () => player.removeEventListener('ended', handleEnded);
  }, [autoPlayAll, currentIndex, durationInFrames, next, totalSteps]);

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

  // Derive pins + pending counts from the live intents list.
  const stepIntents = intents.filter((it) => (
    it.target?.series === fallbackSeries &&
    it.target?.epId === fallbackEpId &&
    it.target?.stepId === step.id
  ));
  const pinsForStep: CommittedPin[] = stepIntents
    .map<CommittedPin | null>((it, idx) => {
      const hash = it.target?.anchorMeta?.hash ?? '';
      const match = /^pin:([\d.]+),([\d.]+)$/.exec(hash);
      if (!match) return null;
      const x = Number.parseFloat(match[1]);
      const y = Number.parseFloat(match[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const status: CommittedPin['status'] = it.processedAt ? 'applied' : 'pending';
      return { id: it.id, x, y, num: idx + 1, status };
    })
    .filter((p): p is CommittedPin => p !== null);
  const pendingForStep = stepIntents.filter((it) => !it.processedAt).length;

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
  const onboardMode = onboardStatus.active;
  const onboardSourceHash = onboardMode
    ? `onboard:${onboardStatus.stage ?? 'active'}`
    : undefined;
  const intentSource = onboardMode ? 'onboard' : 'review';
  const commentTitle = onboardMode
    ? '留言調整系列視覺、語氣、VTuber、卡片偏好；若只修 demo 請明講'
    : (selectModeActive ? '退出留言模式（Esc）' : '點擊畫面元素留言');
  const pinPlaceholder = onboardMode
    ? '調整系列預設、視覺、語氣或這張 demo？若只修 demo 請明講。'
    : '這一點想怎麼改？';
  const selectPlaceholder = (label: string) => (
    onboardMode
      ? `對「${label}」留言… 預設會當成系列設定；若只修 demo 請明講（⌘↵ 送出）`
      : `對「${label}」留言… 可直接貼圖（⌘↵ 送出）`
  );

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
                className={`studio-canvas${selectModeActive ? ' studio-select-mode' : ''}`}
                data-annotatable="card"
                data-annotatable-label="整張卡片"
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

                <PinLayer
                  series={fallbackSeries}
                  epId={fallbackEpId}
                  stepId={step.id}
                  source={intentSource}
                  sourceHash={onboardSourceHash}
                  placeholder={pinPlaceholder}
                  scale={canvasOverlay?.scale ?? 1}
                  pins={pinsForStep}
                  disabled={selectModeActive}
                />

                {/* Virtual audio chip. `audioSrc` is a URL template that always
                    resolves, so we can't use it for existence — instead we
                    key off subtitles presence (only written after a successful
                    TTS run). When real audio is in place the chip is
                    annotatable (common use: "這個詞讀音不對") and ships the
                    step's narration as context. Otherwise it renders 🔇 and
                    is non-interactive. */}
                {currentStudioStep.subtitles && currentStudioStep.subtitles.length > 0 ? (
                  <div
                    className="studio-audio-chip"
                    data-annotatable="audio"
                    data-annotatable-label="音訊"
                    data-annotatable-context={step.narration ?? ''}
                    title="點擊留言：修正這段語音（讀音、停頓、語氣…）"
                  >
                    <span>TTS · 語音</span>
                  </div>
                ) : audioCapability.visible ? (
                  <div
                    className="studio-audio-chip muted"
                    title="此步驟尚未生成語音 — 使用導覽列的 🔊 生成音訊"
                  >
                    <span>🔇 無語音</span>
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          <StatusBar state={statusState} detail={statusDetail} />

          {/* Narration lives as subtitles inside the canvas now; the nav-level
              preview was removed to avoid double display. */}

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
            <button
              className={`nav-btn nav-btn-autoplay${autoPlayAll ? ' active' : ''}`}
              onClick={toggleAutoPlayAll}
              title={autoPlayAll ? '停止自動播放整集' : '自動播放整集'}
            >
              {autoPlayAll ? 'STOP' : 'AUTO'}
            </button>
          </div>

          <div className="nav-center" />

          <div className="nav-right" style={{ position: 'relative' }}>
            <button
              className={`nav-btn${selectModeActive ? ' active' : ''}`}
              onClick={pauseAutoPlayForComment}
              title={commentTitle}
              style={{ padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>💬</span>
              <span>留言</span>
              {pendingForStep > 0 && (
                <span className="action-bar-btn-badge">{pendingForStep}</span>
              )}
            </button>
            {/* Always openable: the modal surfaces capability problems in its
                own preview so the user can see why they're blocked. Running
                state is visually hinted via `active`. */}
            {!onboardMode && audioCapability.visible && (
              <button
                className={`nav-btn${audioJob.status === 'running' ? ' active' : ''}`}
                onClick={() => setAudioModalOpen(true)}
                title={audioButtonTitle}
              >
                {audioButtonLabel}
              </button>
            )}
            {!onboardMode && publishCapability.visible && (
              <button
                className={`nav-btn${prepareModalOpen ? ' active' : ''}`}
                onClick={() => setPrepareModalOpen(true)}
                title="產生並挑選 YouTube metadata 候選"
              >
                📝 Prepare
              </button>
            )}
            {!onboardMode && publishCapability.visible && (
              <button
                className={`nav-btn${publishModalOpen ? ' active' : ''}`}
                onClick={() => setPublishModalOpen(true)}
                title="依 prepare 結果執行 publish"
              >
                🚀 Publish
              </button>
            )}
            {!onboardMode && (
              <button
                className={`nav-btn${showStepEditor ? ' active' : ''}`}
                onClick={() => setShowStepEditor((v) => !v)}
                title="Step 編輯器"
              >
                ✎
              </button>
            )}
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
                <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>publish capability</span>　{publishCapability.visible ? (publishCapability.enabled ? 'enabled' : 'disabled') : 'hidden'}</div>
                {publishCapability.reason && (
                  <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>publish reason</span>　{publishCapability.reason}</div>
                )}
                {onboardStatus.active && (
                  <>
                    <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>onboard phase</span>　{onboardStatus.phaseLabel ?? onboardStatus.stage ?? 'active'}</div>
                    <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>onboard session</span>　{onboardStatus.sessionActive ? 'active' : 'inactive'}</div>
                    <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>pending comments</span>　{onboardStatus.pendingIntents}</div>
                    <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>preview sync</span>　{onboardRefreshPending ? 'reload pending' : 'auto-reload enabled'}</div>
                  </>
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
          <FixListSidebar
            onClose={() => setShowFixList(false)}
            seriesId={seriesId}
            episodeId={episodeId}
            currentStepId={step.id}
          />
        )}
        <SelectMode
          active={selectModeActive}
          onExit={() => setSelectModeActive(false)}
          canvasEl={canvasRef.current}
          stepId={step.id}
          series={fallbackSeries}
          epId={fallbackEpId}
          source={intentSource}
          sourceHash={onboardSourceHash}
          placeholder={selectPlaceholder}
        />
        {!onboardMode && showStepEditor && sourceStep && (
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
      {!onboardMode && audioCapability.visible && (
        <AudioRunner
          open={audioModalOpen}
          onClose={() => setAudioModalOpen(false)}
          episode={draftEpisode}
          series={fallbackSeries}
          epId={fallbackEpId}
          currentStepId={step.id}
          currentStepAudioExists={audioExists}
        />
      )}
      {!onboardMode && publishCapability.visible && (
        <PrepareRunner
          open={prepareModalOpen}
          onClose={() => setPrepareModalOpen(false)}
          series={fallbackSeries}
          epId={fallbackEpId}
          episodeYoutube={draftEpisode.metadata.youtube}
        />
      )}
      {!onboardMode && publishCapability.visible && (
        <PublishRunner
          open={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          series={fallbackSeries}
          epId={fallbackEpId}
        />
      )}
    </ThemeProvider>
  );
};

export default ReviewView;
