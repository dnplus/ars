/**
 * @component BuildOverlay
 * @description Full-screen transition shown after the user triggers a build from
 *              the Plan view. Polls /__ars/build-status every 1.5s while open
 *              and maps `stage` into a five-step typewriter stream. Calls
 *              onDone() when the server transitions to a terminal reviewable
 *              state. Keeps rendering on `failed` / `blocked-assets-missing`
 *              with a red variant + a retry hook.
 *
 *              Design intent: feels like watching a CI pipeline tail. Scan-line
 *              background, typewriter current line, progress bar with glow.
 *              Animation has a `minMs` floor so it's always watchable even if
 *              the real build is already done by the time the overlay mounts.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 1500;

type BuildStatusState =
  | 'idle'
  | 'pending-trigger'
  | 'in-progress'
  | 'ready-for-review'
  | 'ready-for-review-with-warnings'
  | 'blocked-assets-missing'
  | 'failed';

type BuildStatusPayload = {
  state: BuildStatusState;
  stage?: string;
  pendingIntentId?: string;
  episodeSourceMtime?: string;
  lastBuildAt?: string;
  validation?: { ok: boolean; errorCount: number; summary: string };
  warnings?: string[];
};

type BuildStatusResponse = {
  ok: boolean;
  build?: BuildStatusPayload;
  error?: string;
};

type BuildOverlayProps = {
  open: boolean;
  series: string;
  epId: string;
  onDone: () => void;
  onFailed?: (reason: string) => void;
  minMs?: number;
};

type StreamStep = {
  key: string;
  line: string;
  sub: string;
};

const STREAM: StreamStep[] = [
  { key: 'parse',    line: '▸ parsing plan.md',      sub: 'reading episode source' },
  { key: 'resolve',  line: '▸ resolving cards',       sub: 'compiling CardSpec registry' },
  { key: 'render',   line: '▸ rendering canvas',      sub: '1920×1080 · 30fps' },
  { key: 'tts',      line: '▸ synthesizing narration', sub: 'zh-TW · edge-tts' },
  { key: 'pack',     line: '▸ packing ready-for-review', sub: 'validating assets' },
  { key: 'done',     line: '✓ ready for review',      sub: 'opening reviewer…' },
];

function stageToIndex(stage: string | undefined): number {
  if (!stage) return 0;
  if (stage.startsWith('validating')) return 1;
  if (stage.startsWith('building')) return 3;
  if (stage.startsWith('ready-for-review')) return 5;
  if (stage.startsWith('blocked')) return 4;
  if (stage.startsWith('failed')) return 3;
  return 0;
}

export const BuildOverlay: React.FC<BuildOverlayProps> = ({
  open,
  series,
  epId,
  onDone,
  onFailed,
  minMs = 1200,
}) => {
  const [phase, setPhase] = useState<number>(0);
  const [buildState, setBuildState] = useState<BuildStatusState>('pending-trigger');
  const [errorText, setErrorText] = useState<string | null>(null);
  const openedAtRef = useRef<number>(0);
  const doneFiredRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams({ series, ep: epId });
      const res = await fetch(`/__ars/build-status?${params.toString()}`);
      const payload = (await res.json()) as BuildStatusResponse;
      if (!res.ok || !payload.build) return;
      setBuildState(payload.build.state);
      const mapped = stageToIndex(payload.build.stage);
      setPhase((prev) => Math.max(prev, Math.min(STREAM.length - 1, mapped)));

      const isReady =
        payload.build.state === 'ready-for-review' ||
        payload.build.state === 'ready-for-review-with-warnings';
      const isBlocked = payload.build.state === 'blocked-assets-missing';
      const isFailed = payload.build.state === 'failed' || isBlocked;
      const elapsed = Date.now() - openedAtRef.current;

      if (isReady && !doneFiredRef.current) {
        setPhase(STREAM.length - 1);
        const wait = Math.max(0, minMs - elapsed);
        doneFiredRef.current = true;
        window.setTimeout(() => onDone(), wait + 400);
      } else if (isFailed && !doneFiredRef.current) {
        doneFiredRef.current = true;
        const summary = isBlocked
          ? payload.build.warnings?.[0] ?? 'build blocked: hero assets missing'
          : payload.build.validation?.summary ?? 'build failed';
        setErrorText(summary);
        onFailed?.(summary);
      }
    } catch (err) {
      // Swallow transient errors — poll again on the next tick.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch')) return;
    }
  }, [series, epId, minMs, onDone, onFailed]);

  // Lifecycle: reset on open, tear down on close.
  useEffect(() => {
    if (!open) {
      setPhase(0);
      setBuildState('pending-trigger');
      setErrorText(null);
      doneFiredRef.current = false;
      return;
    }
    openedAtRef.current = Date.now();
    doneFiredRef.current = false;

    // Kick an initial poll immediately, then interval.
    void fetchStatus();
    const pollTimer = window.setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);

    // Autonomous phase advance (drives the typewriter even if the server is
    // slow to emit stage changes — caps at phase 4 until server confirms ready).
    const cap = STREAM.length - 2;
    const stepInterval = Math.max(240, Math.floor(minMs / STREAM.length));
    const advance = window.setInterval(() => {
      setPhase((prev) => (prev < cap ? prev + 1 : prev));
    }, stepInterval);

    return () => {
      window.clearInterval(pollTimer);
      window.clearInterval(advance);
    };
  }, [open, fetchStatus, minMs]);

  if (!open) return null;

  const pct = Math.round(((phase + 1) / STREAM.length) * 100);
  const visible = STREAM.slice(0, phase + 1);
  const isFailed =
    buildState === 'failed' ||
    buildState === 'blocked-assets-missing' ||
    !!errorText;

  return (
    <div className={`studio-build-overlay${isFailed ? ' failed' : ''}`}>
      <div className="studio-build-overlay-scan" />
      <div className="studio-build-overlay-inner">
        <div className="studio-build-overlay-label">
          ARS · {isFailed ? 'build blocked' : `building ${epId}`}
        </div>
        <div className="studio-build-overlay-stream">
          {visible.map((s, i) => (
            <div key={s.key} className={`studio-build-line${i === phase ? ' current' : ' done'}`}>
              <div className="studio-build-line-main">{s.line}</div>
              <div className="studio-build-line-sub">{s.sub}</div>
            </div>
          ))}
          {isFailed && (
            <div className="studio-build-line failed-reason">
              <div className="studio-build-line-main">✗ {errorText ?? 'build failed'}</div>
              <div className="studio-build-line-sub">
                {buildState === 'blocked-assets-missing'
                  ? '先補齊 hero 素材，再重試 /ars:build'
                  : `查看 TUI log 或重試 /ars:build ${epId}`}
              </div>
            </div>
          )}
        </div>
        <div className="studio-build-overlay-barwrap">
          <div
            className="studio-build-overlay-bar"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="studio-build-overlay-pct">{String(pct).padStart(3, ' ')}%</div>
      </div>
    </div>
  );
};

export default BuildOverlay;
