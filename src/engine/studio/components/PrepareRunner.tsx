import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionBar } from './ActionBar';
import { INTENT_SUBMITTED_EVENT } from '../constants';
import type { PreparedYoutubeCandidate, YoutubePrepareArtifact } from '../../../studio/prepare-youtube-artifact';
import type { EpisodeMetadata } from '../../shared/types';
import type { ReviewIntent } from '../../../types/review-intent';

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

type PreparePlan = {
  cli: string;
  series: string;
  epId: string;
  preparedExists: boolean;
  preparedStatus: 'pending-review' | 'ready' | null;
  output: {
    artifact: string;
    markdown: string;
  };
  notes: string;
  pendingPrepareIntents: number;
  runningJob: JobState | null;
};

type PreparePlanResponse = { ok: boolean; plan?: PreparePlan; error?: string };
type JobResponse = { ok: boolean; job?: JobState; error?: string };
type PrepareArtifactResponse = {
  ok: boolean;
  artifact?: YoutubePrepareArtifact | null;
  pendingPrepareIntents?: ReviewIntent[];
  paths?: { artifact: string; markdown: string };
  error?: string;
};

type PrepareRunnerProps = {
  open: boolean;
  onClose: () => void;
  series: string;
  epId: string;
  episodeYoutube?: EpisodeMetadata['youtube'];
};

const POLL_INTERVAL_MS = 1500;

export const PrepareRunner: React.FC<PrepareRunnerProps> = ({
  open,
  onClose,
  series,
  epId,
  episodeYoutube,
}) => {
  const [plan, setPlan] = useState<PreparePlan | null>(null);
  const [artifact, setArtifact] = useState<YoutubePrepareArtifact | null>(null);
  const [intents, setIntents] = useState<ReviewIntent[]>([]);
  const [phase, setPhase] = useState<'preview' | 'running' | 'select'>('preview');
  const [job, setJob] = useState<JobState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'prepare' | 'candidates' | 'select' | null>(null);
  const candidates = useMemo(() => artifact?.youtube?.candidates ?? [], [artifact]);
  const chapters = useMemo(() => artifact?.chapters ?? [], [artifact]);
  const selectedCandidateId = artifact?.youtube?.selected ?? null;

  const loadPlan = useCallback(async () => {
    const params = new URLSearchParams({ series, ep: epId });
    const res = await fetch(`/__ars/prepare-plan?${params.toString()}`);
    const payload = (await res.json()) as PreparePlanResponse;
    if (!res.ok || !payload.plan) throw new Error(payload.error ?? `${res.status}`);
    setPlan(payload.plan);
    if (payload.plan.runningJob) {
      setJob(payload.plan.runningJob);
      setPhase('running');
    }
  }, [series, epId]);

  const loadArtifact = useCallback(async () => {
    const params = new URLSearchParams({ series, ep: epId });
    const res = await fetch(`/__ars/prepare-artifact?${params.toString()}`);
    const payload = (await res.json()) as PrepareArtifactResponse;
    if (!res.ok) throw new Error(payload.error ?? `${res.status}`);
    const nextArtifact = payload.artifact ?? null;
    setArtifact(nextArtifact);
    setIntents(payload.pendingPrepareIntents ?? []);
    if ((nextArtifact?.youtube?.candidates?.length ?? 0) > 0) {
      setPhase((prev) => (prev === 'running' ? prev : 'select'));
    }
  }, [series, epId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPhase('preview');
    void Promise.all([loadPlan(), loadArtifact()])
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open, loadPlan, loadArtifact]);

  useEffect(() => {
    if (!open) return;
    const onSubmitted = () => void loadArtifact().catch(() => undefined);
    window.addEventListener(INTENT_SUBMITTED_EVENT, onSubmitted);
    const timer = window.setInterval(() => void loadArtifact().catch(() => undefined), 3000);
    return () => {
      window.removeEventListener(INTENT_SUBMITTED_EVENT, onSubmitted);
      window.clearInterval(timer);
    };
  }, [open, loadArtifact]);

  useEffect(() => {
    if (!open || phase !== 'running') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/__ars/prepare-generate');
        const payload = (await res.json()) as JobResponse;
        if (cancelled || !payload.job) return;
        setJob(payload.job);
        if (payload.job.status === 'succeeded' || payload.job.status === 'failed') {
          await Promise.all([loadPlan(), loadArtifact()]);
          setPhase((payload.job.status === 'succeeded' && candidates.length > 0) ? 'select' : 'preview');
        }
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
  }, [open, phase, loadPlan, loadArtifact, candidates.length]);

  const pendingCountFor = useCallback((candidateId: string, field?: 'title' | 'description' | 'tags' | 'card') => {
    const prefix = field
      ? `prepare:${candidateId}:${field}`
      : `prepare:${candidateId}:`;
    return intents.filter((intent) => {
      if (intent.processedAt) return false;
      const hash = intent.target?.anchorMeta?.hash ?? '';
      return field ? hash === prefix : hash.startsWith(prefix);
    }).length;
  }, [intents]);

  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateId) return null;
    return candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  }, [candidates, selectedCandidateId]);

  const triggerPrepare = useCallback(async () => {
    setBusy('prepare');
    setError(null);
    try {
      const res = await fetch('/__ars/prepare-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, epId }),
      });
      const payload = (await res.json()) as JobResponse;
      if (!res.ok) throw new Error(payload.error ?? `${res.status}`);
      setJob(payload.job ?? null);
      setPhase('running');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [series, epId]);

  const submitPrepareIntent = useCallback(async (
    message: string,
    hash: string,
    title: string,
    kind: ReviewIntent['feedback']['kind'],
  ) => {
    const res = await fetch('/__ars/studio-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'prepare',
        series,
        epId,
        anchorType: 'episode',
        anchorId: epId,
        anchorMeta: { title, hash },
        kind,
        severity: 'medium',
        message,
      }),
    });
    const payload = (await res.json()) as { ok: boolean; intent?: { id: string }; error?: string };
    if (!res.ok || !payload.intent) throw new Error(payload.error ?? `${res.status}`);
    window.dispatchEvent(new CustomEvent(INTENT_SUBMITTED_EVENT));
    await loadArtifact();
  }, [series, epId, loadArtifact]);

  const generateCandidates = useCallback(async () => {
    setBusy('candidates');
    setError(null);
    try {
      await submitPrepareIntent(
        `Generate YouTube metadata candidates for ${series}/${epId}. Run /ars:prepare-youtube ${epId} and write prepare-youtube.json/md.`,
        'prepare:youtube:generate',
        'Prepare YouTube candidates',
        'prepare-generate',
      );
      await loadPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [series, epId, submitPrepareIntent, loadPlan]);

  const selectCandidate = useCallback(async (candidateId: string) => {
    setBusy('select');
    setError(null);
    try {
      await submitPrepareIntent(
        `Apply YouTube candidate ${candidateId} for ${series}/${epId}. Update episode metadata.youtube, then refresh prepare artifact from the applied metadata.`,
        `prepare:${candidateId}:select`,
        `${candidateId} · apply`,
        'prepare-select',
      );
      await loadPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [series, epId, submitPrepareIntent, loadPlan]);

  if (!open) return null;

  const candidateCount = candidates.length;
  const pendingPrepareIntents = intents.filter((intent) => !intent.processedAt).length;

  return (
    <div className="studio-action-modal-backdrop" onClick={phase === 'running' ? undefined : onClose}>
      <div className="studio-action-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="studio-action-modal-header">
          <span className="studio-action-modal-kicker">ACTION · PREPARE</span>
          <h2>📝 Prepare YouTube</h2>
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

        {loading && <div className="studio-action-modal-empty">載入 prepare 狀態中…</div>}
        {error && (
          <div className="studio-action-modal-error">
            <strong>Prepare 失敗：</strong> {error}
          </div>
        )}

        {!loading && plan && phase === 'preview' && (
          <div className="studio-action-modal-body">
            <pre className="studio-action-modal-cli">$ {plan.cli}</pre>
            <dl className="studio-action-modal-fields">
              <div>
                <dt>episode</dt>
                <dd>{plan.series}/{plan.epId}</dd>
              </div>
              <div>
                <dt>artifact</dt>
                <dd><code>{plan.output.artifact}</code></dd>
              </div>
              <div>
                <dt>markdown</dt>
                <dd><code>{plan.output.markdown}</code></dd>
              </div>
              <div>
                <dt>status</dt>
                <dd>{artifact?.status ?? 'not prepared'}</dd>
              </div>
              <div>
                <dt>candidates</dt>
                <dd>{candidateCount}</dd>
              </div>
            </dl>
            <div className="studio-action-modal-warn">{plan.notes}</div>
            {artifact && (
              <>
                <div className="studio-action-modal-subhead">
                  <span>章節預覽</span>
                </div>
                <div className="studio-action-modal-steps">
                  {chapters.map((chapter) => (
                    <div key={`${chapter.timestamp}-${chapter.label}`} className="studio-action-modal-step">
                      <span />
                      <span className="studio-action-modal-step-id">{chapter.timestamp}</span>
                      <span className="studio-action-modal-step-label">{chapter.label}</span>
                      <span className="studio-action-modal-step-chars" />
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="studio-action-modal-actions">
              <button type="button" className="studio-pin-popover-btn" onClick={onClose}>
                關閉
              </button>
              {artifact && candidateCount > 0 ? (
                <button
                  type="button"
                  className="studio-pin-popover-btn primary"
                  onClick={() => setPhase('select')}
                >
                  查看候選
                </button>
              ) : artifact ? (
                <button
                  type="button"
                  className="studio-pin-popover-btn primary"
                  onClick={() => void generateCandidates()}
                  disabled={busy !== null || pendingPrepareIntents > 0}
                >
                  {busy === 'candidates' ? '通知中…' : '請 Claude Code 產生候選'}
                </button>
              ) : (
                <button
                  type="button"
                  className="studio-pin-popover-btn primary"
                  onClick={() => void triggerPrepare()}
                  disabled={busy !== null}
                >
                  {busy === 'prepare' ? '送出中…' : '執行 Prepare'}
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
              {(job?.outputTail ?? []).join('\n') || '等待 prepare 輸出…'}
            </pre>
          </div>
        )}

        {!loading && artifact && phase === 'select' && (
          <div className="studio-action-modal-body">
            <pre className="studio-action-modal-cli">$ {plan?.cli ?? `npx ars prepare youtube ${series}/${epId}`}</pre>
            {pendingPrepareIntents > 0 && (
              <div className="studio-action-modal-warn">
                有 {pendingPrepareIntents} 筆 prepare 留言尚未處理；候選內容會在後台修改後自動刷新。
              </div>
            )}
            {episodeYoutube && (
              <div className="studio-action-modal-warn">
                已套用到 ep metadata：<strong>{episodeYoutube.title}</strong>
              </div>
            )}
            {!episodeYoutube && selectedCandidate && (
              <div className="studio-action-modal-warn">
                已選定 <strong>{selectedCandidate.id}</strong>，等待 Claude Code 套用到 ep metadata。
              </div>
            )}
            <div className="studio-action-modal-actions">
              <button type="button" className="studio-pin-popover-btn" onClick={() => setPhase('preview')}>
                返回
              </button>
              <button
                type="button"
                className="studio-pin-popover-btn"
                onClick={() => void generateCandidates()}
                disabled={busy !== null || pendingPrepareIntents > 0}
              >
                {busy === 'candidates' ? '通知中…' : '請 Claude Code 重產'}
              </button>
              <button
                type="button"
                className="studio-pin-popover-btn primary"
                onClick={onClose}
              >
                完成
              </button>
            </div>

            <div className="studio-prepare-candidates">
              {candidates.map((candidate) => (
                <PrepareCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={selectedCandidateId === candidate.id}
                  pendingCardCount={pendingCountFor(candidate.id)}
                  pendingTitleCount={pendingCountFor(candidate.id, 'title')}
                  pendingDescriptionCount={pendingCountFor(candidate.id, 'description')}
                  pendingTagsCount={pendingCountFor(candidate.id, 'tags')}
                  onSelect={() => void selectCandidate(candidate.id)}
                  selecting={busy === 'select'}
                  series={series}
                  epId={epId}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PrepareCandidateCard: React.FC<{
  candidate: PreparedYoutubeCandidate;
  selected: boolean;
  pendingCardCount: number;
  pendingTitleCount: number;
  pendingDescriptionCount: number;
  pendingTagsCount: number;
  onSelect: () => void;
  selecting: boolean;
  series: string;
  epId: string;
}> = ({
  candidate,
  selected,
  pendingCardCount,
  pendingTitleCount,
  pendingDescriptionCount,
  pendingTagsCount,
  onSelect,
  selecting,
  series,
  epId,
}) => (
  <div className={`studio-prepare-card${selected ? ' selected' : ''}`}>
    <div className="studio-prepare-card-header">
      <div>
        <div className="studio-prepare-card-id">{candidate.id}</div>
        <div className="studio-prepare-card-title-row">
          <strong>{candidate.title}</strong>
          <ActionBar
            anchor={{
              type: 'episode',
              id: epId,
              meta: {
                title: `${candidate.id} · card`,
                hash: `prepare:${candidate.id}:card`,
              },
            }}
            source="prepare"
            series={series}
            epId={epId}
            kind="prepare-edit"
            glyph="📝"
            fixCount={pendingCardCount}
          />
        </div>
      </div>
      <button
        type="button"
        className="studio-pin-popover-btn primary"
        onClick={onSelect}
        disabled={selecting}
      >
        {selected ? '已選定' : '請 Claude Code 套用'}
      </button>
    </div>

    <PrepareField
      label="Title"
      value={candidate.title}
      pendingCount={pendingTitleCount}
      hash={`prepare:${candidate.id}:title`}
      series={series}
      epId={epId}
    />
    <PrepareField
      label="Description"
      value={candidate.description}
      pendingCount={pendingDescriptionCount}
      hash={`prepare:${candidate.id}:description`}
      series={series}
      epId={epId}
      multiline
    />
    <PrepareField
      label="Tags"
      value={candidate.tags.join(', ')}
      pendingCount={pendingTagsCount}
      hash={`prepare:${candidate.id}:tags`}
      series={series}
      epId={epId}
    />

    <div className="studio-prepare-meta">
      <div><strong>Rationale</strong> {candidate.rationale}</div>
      <div><strong>Warnings</strong> {candidate.warnings.join(' / ') || '(none)'}</div>
    </div>
  </div>
);

const PrepareField: React.FC<{
  label: string;
  value: string;
  pendingCount: number;
  hash: string;
  series: string;
  epId: string;
  multiline?: boolean;
}> = ({ label, value, pendingCount, hash, series, epId, multiline = false }) => (
  <div className="studio-prepare-field">
    <div className="studio-prepare-field-header">
      <span>{label}</span>
      <ActionBar
        anchor={{
          type: 'episode',
          id: epId,
          meta: {
            title: label,
            hash,
          },
        }}
        source="prepare"
        series={series}
        epId={epId}
        kind="prepare-edit"
        glyph="💬"
        fixCount={pendingCount}
      />
    </div>
    <div className={`studio-prepare-field-value${multiline ? ' multiline' : ''}`}>{value}</div>
  </div>
);

export default PrepareRunner;
