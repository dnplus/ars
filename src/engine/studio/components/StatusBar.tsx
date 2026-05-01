/**
 * @component StatusBar
 * @description Live Claude Code status strip for the review viewport. Shows a
 *              colored dot + state label (IDLE / POLLING / ONBOARD / BUILDING /
 *              APPLYING / READY / FAILED) + detail message + optional mono tail. Drives
 *              itself from the existing /__ars/build-status poll; "APPLYING" is
 *              pushed in from ReviewView when the user hits batch-apply.
 */
import React from 'react';

export type StatusBarState =
  | 'idle'
  | 'polling'
  | 'onboard'
  | 'watching'
  | 'building'
  | 'applying'
  | 'ready'
  | 'failed';

type StatusBarProps = {
  state: StatusBarState;
  detail?: string;
  tail?: string | null;
};

const STATE_MAP: Record<StatusBarState, { color: string; label: string }> = {
  idle:     { color: 'var(--color-text-muted, rgba(232, 224, 212, 0.6))', label: 'IDLE' },
  polling:  { color: 'var(--color-info, #5b7e9e)',                       label: 'POLLING' },
  onboard:  { color: 'var(--color-info, #5b7e9e)',                       label: 'ONBOARD' },
  watching: { color: 'var(--color-info, #5b7e9e)',                       label: 'WATCHING' },
  building: { color: 'var(--color-info, #5b7e9e)',                       label: 'BUILDING' },
  applying: { color: 'var(--color-warning, #c49a5c)',                    label: 'APPLYING' },
  ready:    { color: 'var(--color-positive, #6b8f71)',                   label: 'READY' },
  failed:   { color: 'var(--color-negative, #8b5e3c)',                   label: 'FAILED' },
};

export const StatusBar: React.FC<StatusBarProps> = ({ state, detail, tail }) => {
  const s = STATE_MAP[state];
  return (
    <div className="studio-statusbar">
      <span className="studio-statusbar-dot" style={{ background: s.color }} />
      <span className="studio-statusbar-label" style={{ color: s.color }}>{s.label}</span>
      {detail && (
        <>
          <span className="studio-statusbar-sep">·</span>
          <span className="studio-statusbar-detail">{detail}</span>
        </>
      )}
      {tail && (
        <>
          <span className="studio-statusbar-sep">·</span>
          <span className="studio-statusbar-tail">{tail}</span>
        </>
      )}
    </div>
  );
};

export default StatusBar;
