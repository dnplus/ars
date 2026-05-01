/**
 * @component AudioRunner
 * @description Two-phase modal for triggering audio (TTS) generation from the
 *              Studio UI. Deliberately concrete (not an abstraction yet) —
 *              prepare/publish will follow once we see what actually needs to
 *              be shared.
 *
 *              Phase 1 · preview
 *                GET /__ars/audio-plan → render CLI command + provider + voice
 *                + per-step narration table (steps + char totals come from the
 *                draft episode we already have client-side).
 *                User may toggle `--no-subtitle` or narrow to specific steps.
 *                Capability failures block the confirm button.
 *
 *              Phase 2 · run
 *                POST /__ars/audio-generate (existing), then poll
 *                GET /__ars/audio-generate every 1.5s to tail `outputTail`.
 *                Finishes on `succeeded` / `failed`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Episode } from '../../shared/types';

type AudioCapability = {
  visible: boolean;
  enabled: boolean;
  reason?: string;
};

type AudioPlan = {
  cli: string;
  series: string;
  epId: string;
  provider: string | null;
  hasDefaultVoice: boolean;
  reviewRequiresNativeTiming: boolean;
  capability: AudioCapability;
  output: { audioDir: string; subtitlesFile: string };
  runningJob: AudioJobState | null;
};

type AudioPlanResponse = { ok: boolean; plan?: AudioPlan; error?: string };

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

type AudioJobResponse = { ok: boolean; job?: AudioJobState; error?: string };

type AudioRunnerProps = {
  open: boolean;
  onClose: () => void;
  episode: Episode;
  series: string;
  epId: string;
  currentStepId?: string;
  currentStepAudioExists?: boolean | null;
};

const POLL_INTERVAL_MS = 1500;

type StepPreview = {
  id: string;
  label: string;
  chars: number;
  selected: boolean;
};

export const AudioRunner: React.FC<AudioRunnerProps> = ({
  open,
  onClose,
  episode,
  series,
  epId,
  currentStepId,
  currentStepAudioExists,
}) => {
  const [plan, setPlan] = useState<AudioPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [phase, setPhase] = useState<'preview' | 'running' | 'done'>('preview');
  const [enableSubtitle, setEnableSubtitle] = useState(true);
  const [steps, setSteps] = useState<StepPreview[]>([]);
  const [job, setJob] = useState<AudioJobState | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // Derive per-step preview from the already-loaded draft episode.
  const initialSteps: StepPreview[] = useMemo(() => {
    const narratableSteps = episode.steps
      .filter((step) => step.id && step.narration)
      .map((step) => {
        const title =
          (step.data as { cardTitle?: string } | undefined)?.cardTitle ?? step.id!;
        return {
          id: step.id!,
          label: title,
          chars: step.narration?.length ?? 0,
          selected: true,
        };
      });
    const shouldSelectCurrent =
      currentStepAudioExists === true &&
      !!currentStepId &&
      narratableSteps.some((step) => step.id === currentStepId);

    if (!shouldSelectCurrent) return narratableSteps;

    return narratableSteps.map((step) => ({
      ...step,
      selected: step.id === currentStepId,
    }));
  }, [currentStepAudioExists, currentStepId, episode]);

  const totalSteps = initialSteps.length;
  const totalChars = useMemo(
    () => initialSteps.reduce((sum, s) => sum + s.chars, 0),
    [initialSteps],
  );

  // Fetch the plan whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setPhase('preview');
    setTriggerError(null);
    setPlanError(null);
    setLoadingPlan(true);
    setSteps(initialSteps);
    (async () => {
      try {
        const params = new URLSearchParams({ series, ep: epId });
        const res = await fetch(`/__ars/audio-plan?${params.toString()}`);
        const payload = (await res.json()) as AudioPlanResponse;
        if (!res.ok || !payload.plan) {
          throw new Error(payload.error ?? `${res.status}`);
        }
        setPlan(payload.plan);
        // If a job is already running (e.g. triggered elsewhere), jump straight
        // into the log view so the user can watch its tail.
        if (payload.plan.runningJob) {
          setJob(payload.plan.runningJob);
          setPhase('running');
        }
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [open, series, epId, initialSteps]);

  // Poll audio-generate while we're in the running phase.
  useEffect(() => {
    if (!open || phase !== 'running') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/__ars/audio-generate');
        const payload = (await res.json()) as AudioJobResponse;
        if (cancelled || !payload.job) return;
        setJob(payload.job);
        if (payload.job.status === 'succeeded' || payload.job.status === 'failed') {
          setPhase('done');
        }
      } catch {
        // Transient; next tick retries.
      }
    };

    void poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, phase]);

  const selectedCount = steps.filter((s) => s.selected).length;

  const toggleStep = useCallback((id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSteps((prev) => {
      const allOn = prev.every((s) => s.selected);
      return prev.map((s) => ({ ...s, selected: !allOn }));
    });
  }, []);

  const commandPreview = useMemo(() => {
    if (!plan) return '';
    const parts = [plan.cli];
    if (!enableSubtitle) parts.push('--no-subtitle');
    const allSelected = steps.every((s) => s.selected);
    if (!allSelected && steps.some((s) => s.selected)) {
      parts.push('--steps', steps.filter((s) => s.selected).map((s) => s.id).join(','));
    }
    return parts.join(' ');
  }, [plan, enableSubtitle, steps]);

  const confirmEnabled =
    plan?.capability.enabled === true &&
    selectedCount > 0 &&
    phase === 'preview';

  const trigger = useCallback(async () => {
    if (!plan) return;
    setTriggerError(null);
    const selectedIds = steps.filter((s) => s.selected).map((s) => s.id);
    // Only send `steps` if the user narrowed the set; empty = all (server
    // treats absent as "all steps").
    const body: Record<string, unknown> = { series, epId };
    if (!enableSubtitle) body.noSubtitle = true;
    if (selectedIds.length > 0 && selectedIds.length < steps.length) {
      body.steps = selectedIds;
    }
    try {
      const res = await fetch('/__ars/audio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as AudioJobResponse;
      if (!res.ok) throw new Error(payload.error ?? `${res.status}`);
      setJob(payload.job ?? null);
      setPhase('running');
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : String(err));
    }
  }, [plan, series, epId, enableSubtitle, steps]);

  if (!open) return null;

  const capability = plan?.capability;
  const capabilityBlocked = capability && !capability.enabled;

  return (
    <div className="studio-action-modal-backdrop" onClick={onClose}>
      <div
        className="studio-action-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="studio-action-modal-header">
          <span className="studio-action-modal-kicker">ACTION · AUDIO</span>
          <h2>🔊 生成整集語音</h2>
          <button
            type="button"
            className="studio-action-modal-close"
            onClick={onClose}
            aria-label="close"
          >
            ×
          </button>
        </div>

        {loadingPlan && (
          <div className="studio-action-modal-empty">載入設定中…</div>
        )}

        {planError && (
          <div className="studio-action-modal-error">
            <strong>無法讀取設定：</strong> {planError}
          </div>
        )}

        {plan && phase === 'preview' && (
          <div className="studio-action-modal-body">
            <pre className="studio-action-modal-cli">$ {commandPreview}</pre>

            <dl className="studio-action-modal-fields">
              <div>
                <dt>episode</dt>
                <dd>{plan.series}/{plan.epId}</dd>
              </div>
              <div>
                <dt>provider</dt>
                <dd>{plan.provider ?? <em>未設定</em>}</dd>
              </div>
              <div>
                <dt>voice</dt>
                <dd>
                  {plan.hasDefaultVoice
                    ? 'series-config.ts speech.defaults.voice'
                    : <em>依環境變數 MINIMAX_VOICE_ID</em>}
                </dd>
              </div>
              <div>
                <dt>inputs</dt>
                <dd>{totalSteps} steps · {totalChars} chars</dd>
              </div>
              <div>
                <dt>output</dt>
                <dd>
                  <code>{plan.output.audioDir}/</code>
                  <br />
                  <code>{plan.output.subtitlesFile}</code>
                </dd>
              </div>
              <div>
                <dt>subtitle</dt>
                <dd>
                  <label className="studio-action-modal-toggle">
                    <input
                      type="checkbox"
                      checked={enableSubtitle}
                      onChange={(e) => setEnableSubtitle(e.target.checked)}
                    />
                    產生字幕時間軸（Whisper / native timing）
                  </label>
                </dd>
              </div>
            </dl>

            {capabilityBlocked && (
              <div className="studio-action-modal-warn">
                <strong>無法執行：</strong>
                {capability?.reason ?? '未知原因'}
              </div>
            )}

            <div className="studio-action-modal-subhead">
              <span>選擇要重新生成的 step（{selectedCount}/{totalSteps}）</span>
              <button
                type="button"
                className="studio-action-modal-link"
                onClick={toggleAll}
              >
                {steps.every((s) => s.selected) ? '全部取消' : '全選'}
              </button>
            </div>
            <div className="studio-action-modal-steps">
              {steps.map((step) => (
                <label key={step.id} className="studio-action-modal-step">
                  <input
                    type="checkbox"
                    checked={step.selected}
                    onChange={() => toggleStep(step.id)}
                  />
                  <span className="studio-action-modal-step-id">{step.id}</span>
                  <span className="studio-action-modal-step-label">{step.label}</span>
                  <span className="studio-action-modal-step-chars">{step.chars}</span>
                </label>
              ))}
              {steps.length === 0 && (
                <div className="studio-action-modal-empty">
                  此 episode 沒有設定 narration 的 step。
                </div>
              )}
            </div>

            {triggerError && (
              <div className="studio-action-modal-error">
                <strong>送出失敗：</strong>{triggerError}
              </div>
            )}

            <div className="studio-action-modal-actions">
              <button type="button" className="studio-pin-popover-btn" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="studio-pin-popover-btn primary"
                onClick={() => void trigger()}
                disabled={!confirmEnabled}
                title={
                  capabilityBlocked
                    ? capability?.reason
                    : selectedCount === 0
                    ? '至少選一個 step'
                    : undefined
                }
              >
                ✓ 確認執行
              </button>
            </div>
          </div>
        )}

        {(phase === 'running' || phase === 'done') && (
          <div className="studio-action-modal-body">
            <div className="studio-action-modal-running-header">
              <span className={`studio-statusbar-dot ${job?.status ?? 'running'}`} />
              <strong>
                {job?.status === 'succeeded'
                  ? '完成'
                  : job?.status === 'failed'
                  ? '失敗'
                  : '執行中…'}
              </strong>
              {job?.finishedAt && (
                <span className="studio-action-modal-meta">
                  · {new Date(job.finishedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <pre className="studio-action-modal-log">
              {(job?.outputTail ?? []).join('\n') || '等待 TTS 輸出…'}
            </pre>

            {job?.status === 'failed' && (
              <div className="studio-action-modal-error">
                exit code {job.exitCode ?? 'n/a'}
              </div>
            )}

            <div className="studio-action-modal-actions">
              <button
                type="button"
                className="studio-pin-popover-btn primary"
                onClick={onClose}
                disabled={job?.status === 'running'}
              >
                {job?.status === 'running' ? '…執行中' : '關閉'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRunner;
