/**
 * @component BuildView
 * @description Build phase of the Studio shell. Observes build state by polling
 *              `/__ars/build-status` (stateless server-side aggregator that reads
 *              workstate.json + .ars/studio-intents/ + episode source mtime).
 *              "Trigger Build" POSTs to `/__ars/build-trigger`
 *              which writes a StudioIntent of kind `build-trigger` — the TUI-side
 *              /ars:apply-review skill observes that intent and invokes
 *              /ars:build <epId>. Build is a Claude Code skill, NOT a CLI
 *              subprocess, so this view intentionally does not spawn any work.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionBar } from '../components/ActionBar';

const POLL_INTERVAL_MS = 2000;

type BuildState =
  | 'idle'
  | 'pending-trigger'
  | 'in-progress'
  | 'ready-for-review'
  | 'failed';

type BuildStatusPayload = {
  state: BuildState;
  stage?: string;
  pendingIntentId?: string;
  pendingIntentAt?: string;
  episodeSourcePath?: string;
  episodeSourceMtime?: string;
};

type BuildStatusResponse = {
  ok: boolean;
  build?: BuildStatusPayload;
  error?: string;
};

type TriggerResponse = {
  ok: boolean;
  intentId?: string;
  writtenAt?: string;
  error?: string;
};

type BuildViewProps = {
  series: string;
  epId: string;
};

export const BuildView: React.FC<BuildViewProps> = ({ series, epId }) => {
  const [status, setStatus] = useState<BuildStatusPayload>({ state: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const pollingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const params = new URLSearchParams({ series, ep: epId });
      const res = await fetch(`/__ars/build-status?${params.toString()}`);
      const payload = (await res.json()) as BuildStatusResponse;
      if (!res.ok || !payload.build) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setStatus(payload.build);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      pollingRef.current = false;
    }
  }, [series, epId]);

  useEffect(() => {
    void fetchStatus();
    const active = status.state === 'pending-trigger' || status.state === 'in-progress';
    if (!active) return;
    const timer = window.setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchStatus, status.state]);

  const handleTrigger = useCallback(async () => {
    if (triggering) return;
    setTriggering(true);
    try {
      const res = await fetch('/__ars/build-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, epId }),
      });
      const payload = (await res.json()) as TriggerResponse;
      if (!res.ok || !payload.intentId) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setStatus((prev) => ({ ...prev, state: 'pending-trigger', pendingIntentId: payload.intentId }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggering(false);
    }
  }, [series, epId, triggering]);

  const handleGoReview = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('phase', 'review');
    window.history.pushState(null, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const ctaLabel = CTA_LABELS[status.state];
  const ctaDisabled =
    triggering ||
    status.state === 'pending-trigger' ||
    status.state === 'in-progress';
  const ctaOnClick = status.state === 'ready-for-review' ? handleGoReview : handleTrigger;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <header style={cardHeaderStyle}>
          <div>
            <div style={{ fontSize: 13 }}>{series} / {epId}</div>
            <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 56%, transparent)' }}>
              Build phase
            </div>
          </div>
          <ActionBar
            anchor={{ type: 'episode', id: epId }}
            source="build"
            series={series}
            epId={epId}
            kind="other"
          />
        </header>

        <div style={cardBodyStyle}>
          <StatusChip state={status.state} stage={status.stage} />

          <button
            type="button"
            onClick={() => void ctaOnClick()}
            disabled={ctaDisabled}
            style={ctaButtonStyle(status.state, ctaDisabled)}
          >
            {triggering ? '🔨 送 trigger…' : ctaLabel}
          </button>

          <dl style={metaListStyle}>
            {status.stage && (
              <Row label="workstate.stage" value={<code style={codeStyle}>{status.stage}</code>} />
            )}
            {status.pendingIntentId && (
              <Row label="pending intent" value={<code style={codeStyle}>{status.pendingIntentId}</code>} />
            )}
            {status.episodeSourcePath && (
              <Row
                label="episode source"
                value={(
                  <span>
                    <code style={codeStyle}>{status.episodeSourcePath}</code>
                    {status.episodeSourceMtime && (
                      <span style={{ marginLeft: 8, opacity: 0.6 }}>
                        · {new Date(status.episodeSourceMtime).toLocaleTimeString()}
                      </span>
                    )}
                  </span>
                )}
              />
            )}
          </dl>

          {error && (
            <p style={{ margin: 0, color: 'var(--color-negative, #f87171)', fontSize: 13 }}>
              {error}
            </p>
          )}

          <p style={hintStyle}>
            「觸發 Build」會寫一筆 <code style={codeStyle}>build-trigger</code> Studio intent 回 TUI；
            正在跑 <code style={codeStyle}>/ars:review</code> 或 <code style={codeStyle}>/ars:apply-review</code>
            的 Claude Code 會接手呼叫 <code style={codeStyle}>/ars:build {epId}</code>。
          </p>
        </div>
      </div>
    </div>
  );
};

const CTA_LABELS: Record<BuildState, string> = {
  'idle': '🔨 觸發 Build',
  'pending-trigger': '⏳ 等 TUI 接手…',
  'in-progress': '🔨 Build 中…',
  'ready-for-review': '✅ 前往 Review',
  'failed': '🔨 重試 Build',
};

const STATE_LABEL: Record<BuildState, string> = {
  'idle': 'idle — 還沒 build',
  'pending-trigger': 'pending-trigger — 等 TUI 接手',
  'in-progress': 'in-progress — Build 中',
  'ready-for-review': 'ready-for-review — 可進 review',
  'failed': 'failed — build 失敗',
};

const STATE_COLOR: Record<BuildState, string> = {
  'idle': '#64748b',
  'pending-trigger': '#f59e0b',
  'in-progress': '#3b82f6',
  'ready-for-review': '#4ade80',
  'failed': '#f87171',
};

const StatusChip: React.FC<{ state: BuildState; stage?: string }> = ({ state, stage }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 999,
    background: `color-mix(in srgb, ${STATE_COLOR[state]} 18%, transparent)`,
    border: `1px solid ${STATE_COLOR[state]}`,
    fontSize: 12,
    color: STATE_COLOR[state],
    alignSelf: 'flex-start',
  }}>
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: 999,
      background: STATE_COLOR[state],
    }} />
    {STATE_LABEL[state]}
    {stage && state === 'in-progress' && (
      <span style={{ marginLeft: 6, opacity: 0.8 }}>· {stage.split(':')[0]}</span>
    )}
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
    <dt style={{ minWidth: 128, opacity: 0.6 }}>{label}</dt>
    <dd style={{ margin: 0, flex: 1 }}>{value}</dd>
  </div>
);

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: '40px 24px',
  background: 'var(--color-bg-dark, #0a1628)',
  color: 'var(--color-text-on-dark, #e2e8f0)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 640,
  background: 'var(--color-overlay-bg, rgba(15,23,42,0.8))',
  border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
  borderRadius: 14,
  overflow: 'hidden',
  fontFamily: 'var(--font-main, system-ui, sans-serif)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 18px',
  borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
};

const cardBodyStyle: React.CSSProperties = {
  padding: '20px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  fontSize: 14,
  lineHeight: 1.7,
};

const ctaButtonStyle = (state: BuildState, disabled: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  borderRadius: 10,
  border: `1px solid ${STATE_COLOR[state]}`,
  background: disabled
    ? `color-mix(in srgb, ${STATE_COLOR[state]} 14%, transparent)`
    : `color-mix(in srgb, ${STATE_COLOR[state]} 30%, transparent)`,
  color: 'var(--color-text-on-dark, #e2e8f0)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 14,
  fontWeight: 500,
  alignSelf: 'flex-start',
  opacity: disabled ? 0.7 : 1,
});

const metaListStyle: React.CSSProperties = {
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-code, ui-monospace, monospace)',
  fontSize: 12,
  padding: '1px 6px',
  borderRadius: 4,
  background: 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 8%, transparent)',
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  color: 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 56%, transparent)',
};

export default BuildView;
