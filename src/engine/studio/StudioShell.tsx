/**
 * @component StudioShell
 * @description Top-level Studio shell. Reads `?phase=` from the URL and renders
 *              the matching phase view (plan / build / review). Defaults to
 *              `review` so existing `ars review open` behavior stays the same.
 *              Phase tabs are intentionally minimal in this commit — Plan and
 *              Build views land in later commits.
 */
import React, { useEffect, useState } from 'react';
import type { Episode } from '../shared/types';
import { ReviewView } from './views/ReviewView';
import { PlanView } from './views/PlanView';
import { BuildView } from './views/BuildView';

export type StudioPhase = 'plan' | 'build' | 'review';

const KNOWN_PHASES: readonly StudioPhase[] = ['plan', 'build', 'review'];

function readPhaseFromUrl(): StudioPhase {
  if (typeof window === 'undefined') return 'review';
  const raw = new URLSearchParams(window.location.search).get('phase')?.trim();
  return KNOWN_PHASES.includes(raw as StudioPhase) ? (raw as StudioPhase) : 'review';
}

type StudioShellProps = {
  episode: Episode | null;
  episodeId: string;
  seriesId: string;
};

export const StudioShell: React.FC<StudioShellProps> = ({ episode, episodeId, seriesId }) => {
  const [phase, setPhase] = useState<StudioPhase>(() => readPhaseFromUrl());

  useEffect(() => {
    const onPopState = () => setPhase(readPhaseFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const switchPhase = (next: StudioPhase) => {
    if (next === phase) return;
    const url = new URL(window.location.href);
    url.searchParams.set('phase', next);
    window.history.replaceState(null, '', url.toString());
    setPhase(next);
  };

  let body: React.ReactNode;
  if (phase === 'review') {
    if (!episode) {
      body = <PhasePlaceholder message={`Episode "${episodeId}" 尚未 build。請先在 TUI 跑 /ars:build。`} />;
    } else {
      body = <ReviewView episode={episode} episodeId={episodeId} seriesId={seriesId} />;
    }
  } else if (phase === 'plan') {
    body = <PlanView series={seriesId} epId={episodeId} />;
  } else {
    body = <BuildView series={seriesId} epId={episodeId} />;
  }

  return (
    <div className="studio-shell">
      <div className="studio-shell-tabs">
        {KNOWN_PHASES.map((p) => (
          <button
            key={p}
            type="button"
            className={`studio-shell-tab${p === phase ? ' active' : ''}`}
            onClick={() => switchPhase(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="studio-shell-body">{body}</div>
    </div>
  );
};

const PhasePlaceholder: React.FC<{ message: string }> = ({ message }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 14,
    padding: '40px 24px',
    textAlign: 'center',
  }}>
    {message}
  </div>
);

export default StudioShell;
