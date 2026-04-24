/**
 * @component StudioShell
 * @description Top-level Studio shell. Reads `?phase=` and `?ep=` from the URL
 *              and renders the matching phase view (plan / review). Build is
 *              NOT a phase — it's an action triggered from the Plan view that
 *              opens a full-screen BuildOverlay and auto-drops the user into
 *              Review when the server transitions to ready. A legacy
 *              `?phase=build` URL redirects to `plan` for bookmark compat.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { Episode } from '../shared/types';
import { ReviewView } from './views/ReviewView';
import { PlanView } from './views/PlanView';
import { SlideView } from './views/SlideView';
import { BuildOverlay } from './components/BuildOverlay';

export type StudioPhase = 'plan' | 'build' | 'review' | 'slide';

const KNOWN_PHASES: readonly StudioPhase[] = ['plan', 'build', 'review', 'slide'];

function readPhaseFromUrl(): StudioPhase {
  if (typeof window === 'undefined') return 'plan';
  const raw = new URLSearchParams(window.location.search).get('phase')?.trim();
  if (KNOWN_PHASES.includes(raw as StudioPhase)) {
    return raw as StudioPhase;
  }
  // Legacy: ?phase=build was removed. Land the user on plan.
  return 'plan';
}

function readEpisodeFromUrl(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get('ep')?.trim() || fallback;
}

export type EpisodeOption = {
  id: string;
  title: string;
};

type StudioShellProps = {
  episodes: Record<string, Episode>;
  episodeOptions: EpisodeOption[];
  initialEpisodeId: string;
  seriesId: string;
};

export const StudioShell: React.FC<StudioShellProps> = ({
  episodes,
  episodeOptions,
  initialEpisodeId,
  seriesId,
}) => {
  const [phase, setPhase] = useState<StudioPhase>(() => readPhaseFromUrl());
  const [episodeId, setEpisodeId] = useState<string>(() => readEpisodeFromUrl(initialEpisodeId));
  const [buildOverlayOpen, setBuildOverlayOpen] = useState(false);
  const [planDirtyByEpisode, setPlanDirtyByEpisode] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onPopState = () => {
      setPhase(readPhaseFromUrl());
      setEpisodeId(readEpisodeFromUrl(initialEpisodeId));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialEpisodeId]);

  const updateUrl = useCallback((nextPhase: StudioPhase, nextEp: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('phase', nextPhase);
    url.searchParams.set('ep', nextEp);
    url.searchParams.set('series', seriesId);
    window.history.replaceState(null, '', url.toString());
  }, [seriesId]);

  const switchPhase = useCallback((next: StudioPhase) => {
    if (next === phase) return;
    updateUrl(next, episodeId);
    setPhase(next);
  }, [phase, episodeId, updateUrl]);

  const switchEpisode = useCallback((next: string) => {
    if (next === episodeId) return;
    updateUrl(phase, next);
    setEpisodeId(next);
  }, [episodeId, phase, updateUrl]);

  const handleBuildStarted = useCallback(() => {
    setBuildOverlayOpen(true);
  }, []);

  const handleBuildDone = useCallback(() => {
    setBuildOverlayOpen(false);
    setPlanDirtyByEpisode((prev) => ({ ...prev, [episodeId]: false }));
    if (phase !== 'review') {
      updateUrl('review', episodeId);
      setPhase('review');
    }
  }, [phase, episodeId, updateUrl]);

  const handleBuildFailed = useCallback(() => {
    setBuildOverlayOpen(false);
  }, []);

  // Ensure URL reflects the current phase even on first mount (plan default).
  useEffect(() => {
    updateUrl(phase, episodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const episode = episodes[episodeId] ?? null;

  let body: React.ReactNode;
  if (phase === 'review') {
    if (!episode) {
      body = (
        <EpisodeNotFound
          episodeId={episodeId}
          seriesId={seriesId}
          options={episodeOptions}
          onPick={switchEpisode}
        />
      );
    } else {
      body = (
        <ReviewView
          key={episodeId}
          episode={episode}
          episodeId={episodeId}
          seriesId={seriesId}
        />
      );
    }
  } else if (phase === 'slide') {
    if (!episode) {
      body = (
        <EpisodeNotFound
          episodeId={episodeId}
          seriesId={seriesId}
          options={episodeOptions}
          onPick={switchEpisode}
        />
      );
    } else {
      body = (
        <SlideView
          key={episodeId}
          episode={episode}
          episodeId={episodeId}
          seriesId={seriesId}
        />
      );
    }
  } else {
    body = (
      <PlanView
        key={episodeId}
        series={seriesId}
        epId={episodeId}
        onBuildStarted={handleBuildStarted}
        dirtyHintFromShell={planDirtyByEpisode[episodeId] === true}
      />
    );
  }

  return (
    <div className="studio-shell">
      <div className="studio-shell-tabs">
        <div style={{ display: 'flex', gap: 4 }}>
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
        {episodeOptions.length > 0 && (
          <EpisodeSwitcher
            current={episodeId}
            options={episodeOptions}
            onChange={switchEpisode}
          />
        )}
      </div>
      <div className="studio-shell-body">{body}</div>
      <BuildOverlay
        open={buildOverlayOpen}
        series={seriesId}
        epId={episodeId}
        onDone={handleBuildDone}
        onFailed={handleBuildFailed}
      />
    </div>
  );
};

const EpisodeSwitcher: React.FC<{
  current: string;
  options: EpisodeOption[];
  onChange: (id: string) => void;
}> = ({ current, options, onChange }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 62%, transparent)',
    }}
  >
    <span>ep</span>
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--color-overlay-bg, rgba(15,23,42,0.8))',
        color: 'var(--color-text-on-dark, #e2e8f0)',
        border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.id} — {opt.title}
        </option>
      ))}
    </select>
  </label>
);

const EpisodeNotFound: React.FC<{
  episodeId: string;
  seriesId: string;
  options: EpisodeOption[];
  onPick: (id: string) => void;
}> = ({ episodeId, seriesId, options, onPick }) => (
  <div
    style={{
      padding: 24,
      color: 'var(--color-text-on-dark, #e2e8f0)',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    <h2 style={{ color: '#60a5fa', marginBottom: 12 }}>
      Episode "{episodeId}" not found in series "{seriesId}".
    </h2>
    {options.length > 0 ? (
      <>
        <p style={{ marginBottom: 12 }}>Available episodes:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {options.map((opt) => (
            <li key={opt.id} style={{ margin: '6px 0' }}>
              <button
                type="button"
                onClick={() => onPick(opt.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                {opt.id} — {opt.title}
              </button>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <p>No episodes found in this series. 在 TUI 跑 <code>/ars:plan</code> 建立第一集。</p>
    )}
  </div>
);

export default StudioShell;
