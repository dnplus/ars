import React, { useCallback, useEffect, useMemo, useState } from 'react';

type JobState = {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  series?: string;
  epId?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  exitCode?: number | null;
  outputTail?: string[];
};

type PublishPlan = {
  cli: string;
  series: string;
  epId: string;
  requiresPrepared: boolean;
  preparedExists: boolean;
  preparedReady: boolean;
  pendingPrepareIntents: number;
  preparedArtifact: string;
  privacyOptions: Array<'private' | 'unlisted' | 'public'>;
  defaultPrivacy: 'private' | 'unlisted' | 'public';
  irreversible: boolean;
  runningJob: JobState | null;
};

type PublishPlanResponse = { ok: boolean; plan?: PublishPlan; error?: string };
type JobResponse = { ok: boolean; job?: JobState; error?: string };

type PublishRunnerProps = {
  open: boolean;
  onClose: () => void;
  series: string;
  epId: string;
};

const POLL_INTERVAL_MS = 1500;

export const PublishRunner: React.FC<PublishRunnerProps> = ({
  open,
  onClose,
  series,
  epId,
}) => {
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [phase, setPhase] = useState<'preview' | 'confirm' | 'running'>('preview');
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [dryRun, setDryRun] = useState(false);
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    const params = new URLSearchParams({ series, ep: epId });
    const res = await fetch(`/__ars/publish-plan?${params.toString()}`);
    const payload = (await res.json()) as PublishPlanResponse;
    if (!res.ok || !payload.plan) throw new Error(payload.error ?? `${res.status}`);
    setPlan(payload.plan);
    setPrivacy(payload.plan.defaultPrivacy);
    if (payload.plan.runningJob) {
      setJob(payload.plan.runningJob);
      setPhase('running');
    }
  }, [series, epId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPhase('preview');
    void loadPlan()
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open, loadPlan]);

  useEffect(() => {
    if (!open || phase !== 'running') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/__ars/publish-generate');
        const payload = (await res.json()) as JobResponse;
        if (cancelled || !payload.job) return;
        setJob(payload.job);
      } catch {
        // ignore transient polling failures
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, phase]);

  const commandPreview = useMemo(() => {
    if (!plan) return '';
    const parts = [plan.cli, '--privacy', privacy];
    if (dryRun) parts.push('--dry-run');
    if (force) parts.push('--force');
    return parts.join(' ');
  }, [plan, privacy, dryRun, force]);

  const blockedReason = !plan
    ? null
    : !plan.preparedExists
      ? '還沒有 prepare artifact，請先執行 Prepare。'
      : !plan.preparedReady
        ? 'Prepare 尚未 ready，請先選定一個 candidate。'
        : plan.pendingPrepareIntents > 0
          ? `Prepare 還有 ${plan.pendingPrepareIntents} 筆 pending 留言。`
          : null;

  const trigger = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/__ars/publish-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series,
          epId,
          mode: 'youtube',
          privacy,
          dryRun,
          force,
        }),
      });
      const payload = (await res.json()) as JobResponse;
      if (!res.ok) throw new Error(payload.error ?? `${res.status}`);
      setJob(payload.job ?? null);
      setPhase('running');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [series, epId, privacy, dryRun, force]);

  if (!open) return null;

  return (
    <div className="studio-action-modal-backdrop" onClick={phase === 'running' ? undefined : onClose}>
      <div className="studio-action-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="studio-action-modal-header">
          <span className="studio-action-modal-kicker">ACTION · PUBLISH</span>
          <h2>🚀 Publish YouTube</h2>
          <button
            type="button"
            className="studio-action-modal-close"
            onClick={onClose}
            aria-label="close"
            disabled={phase === 'running'}
          >
            ×
          </button>
        </div>

        {loading && <div className="studio-action-modal-empty">載入 publish 狀態中…</div>}
        {error && (
          <div className="studio-action-modal-error">
            <strong>Publish 失敗：</strong> {error}
          </div>
        )}

        {!loading && plan && phase !== 'running' && (
          <div className="studio-action-modal-body">
            <pre className="studio-action-modal-cli">$ {commandPreview}</pre>
            <dl className="studio-action-modal-fields">
              <div>
                <dt>episode</dt>
                <dd>{plan.series}/{plan.epId}</dd>
              </div>
              <div>
                <dt>artifact</dt>
                <dd><code>{plan.preparedArtifact}</code></dd>
              </div>
              <div>
                <dt>ready</dt>
                <dd>{plan.preparedReady ? 'yes' : 'no'}</dd>
              </div>
              <div>
                <dt>privacy</dt>
                <dd>
                  <select value={privacy} onChange={(e) => setPrivacy(e.target.value as 'private' | 'unlisted' | 'public')}>
                    {plan.privacyOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </dd>
              </div>
              <div>
                <dt>options</dt>
                <dd style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label className="studio-action-modal-toggle">
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                    dry-run
                  </label>
                  <label className="studio-action-modal-toggle">
                    <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                    force rebuild
                  </label>
                </dd>
              </div>
            </dl>
            <div className="studio-action-modal-warn">
              這個動作會執行正式 publish CLI。UI 會先做一次明確確認，再送出不可逆操作。
            </div>
            {blockedReason && (
              <div className="studio-action-modal-error">{blockedReason}</div>
            )}
            <div className="studio-action-modal-actions">
              <button type="button" className="studio-pin-popover-btn" onClick={onClose}>
                關閉
              </button>
              {phase === 'preview' ? (
                <button
                  type="button"
                  className="studio-pin-popover-btn primary"
                  onClick={() => setPhase('confirm')}
                  disabled={!!blockedReason}
                >
                  下一步確認
                </button>
              ) : (
                <button
                  type="button"
                  className="studio-pin-popover-btn primary"
                  onClick={() => void trigger()}
                  disabled={!!blockedReason}
                >
                  確認 Publish
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div className="studio-action-modal-body">
            <div className="studio-action-modal-running-header">
              <span className={`studio-statusbar-dot ${job?.status ?? 'running'}`} />
              <strong>
                {job?.status === 'succeeded' ? '完成' : job?.status === 'failed' ? '失敗' : '執行中…'}
              </strong>
            </div>
            <pre className="studio-action-modal-log">
              {(job?.outputTail ?? []).join('\n') || '等待 publish 輸出…'}
            </pre>
            {job?.status === 'failed' && (
              <div className="studio-action-modal-error">exit code {job.exitCode ?? 'n/a'}</div>
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

export default PublishRunner;
