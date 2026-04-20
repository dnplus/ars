/**
 * @component FixListSidebar
 * @description Sidebar listing every StudioIntent the server has on disk, with
 *              a pending / applied / skipped header count, per-item cycle
 *              button, a "僅本卡" filter toggle that shows only intents whose
 *              stepId matches the currently-viewed step, and a batch footer
 *              button that flashes an info toast (the actual apply happens on
 *              the TUI side — we don't mutate anything server-side here).
 *
 *              Applied state is derived from `processedAt`. Skipped is a
 *              client-only concept persisted in localStorage so the user can
 *              dismiss an intent locally without the TUI acting on it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReviewIntent } from '../../../types/review-intent';
import { EPISODE_SCOPE_ID, INTENT_SUBMITTED_EVENT, KIND_LABELS } from '../constants';

type FixListSidebarProps = {
  onClose: () => void;
  seriesId?: string;
  episodeId?: string;
  currentStepId?: string;
};

type ReviewIntentsResponse = {
  ok: boolean;
  intents: ReviewIntent[];
};

type FixStatus = 'pending' | 'applied' | 'skipped';

const SKIP_STORAGE_KEY = 'ars-studio-skipped-intents';

const KIND_BADGE_COLORS: Record<string, string> = {
  visual: 'var(--color-highlight)',
  content: 'var(--color-positive)',
  other: 'var(--color-secondary)',
  timing: 'var(--color-warning)',
  'plan-section': 'var(--color-info)',
  'build-trigger': 'var(--color-primary)',
};

const truncate = (str: string, max: number): string =>
  str.length > max ? `${str.slice(0, max)}…` : str;

const hasAttachment = (intent: ReviewIntent): boolean =>
  !!intent.attachments?.screenshotPath || !!intent.attachments?.screenshotDataUrl;

function readSkipped(): Set<string> {
  try {
    const raw = localStorage.getItem(SKIP_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeSkipped(set: Set<string>) {
  try {
    localStorage.setItem(SKIP_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore quota errors
  }
}

function getStatus(intent: ReviewIntent, skipped: Set<string>): FixStatus {
  if (intent.processedAt) return 'applied';
  if (skipped.has(intent.id)) return 'skipped';
  return 'pending';
}

export const FixListSidebar: React.FC<FixListSidebarProps> = ({
  onClose,
  seriesId,
  episodeId,
  currentStepId,
}) => {
  const [intents, setIntents] = useState<ReviewIntent[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(() => readSkipped());
  const [onlyThisStep, setOnlyThisStep] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchIntents = async () => {
      try {
        const res = await fetch('/__ars/studio-intents');
        if (!res.ok) return;
        const payload = (await res.json()) as ReviewIntentsResponse;
        if (!cancelled && payload.ok) {
          const filtered = payload.intents.filter((intent) => {
            const target = intent.target;
            if (!target) return false;
            if (seriesId && target.series && target.series !== seriesId) return false;
            if (episodeId && target.epId && target.epId !== episodeId) return false;
            return true;
          });
          setIntents(filtered);
        }
      } catch {
        // ignore
      }
    };

    void fetchIntents();
    const timer = window.setInterval(() => void fetchIntents(), 5000);
    window.addEventListener(INTENT_SUBMITTED_EVENT, fetchIntents);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(INTENT_SUBMITTED_EVENT, fetchIntents);
    };
  }, [seriesId, episodeId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const toggleSkip = useCallback((intentId: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(intentId)) {
        next.delete(intentId);
      } else {
        next.add(intentId);
      }
      writeSkipped(next);
      return next;
    });
  }, []);

  const counts = useMemo(() => {
    const acc = { pending: 0, applied: 0, skipped: 0 };
    for (const intent of intents) {
      const s = getStatus(intent, skipped);
      acc[s] += 1;
    }
    return acc;
  }, [intents, skipped]);

  const visibleIntents = useMemo(() => {
    if (!onlyThisStep || !currentStepId) return intents;
    return intents.filter((intent) => intent.target?.stepId === currentStepId);
  }, [intents, onlyThisStep, currentStepId]);

  const handleBatchApply = useCallback(() => {
    if (counts.pending === 0) return;
    setToast(`已通知 Claude Code，開始套用 ${counts.pending} 筆 pending fix`);
  }, [counts.pending]);

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--color-bg-dark)',
        borderLeft: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        fontFamily: 'var(--font-main, sans-serif)',
        color: 'var(--color-text-on-dark)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--color-border-light)',
          background: 'var(--color-overlay-bg)',
          flexShrink: 0,
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-primary, #c4a77d)' }}>
            修正清單 · {intents.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'color-mix(in srgb, var(--color-text-on-dark) 65%, transparent)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '2px 4px',
            }}
          >
            ✕
          </button>
        </div>
        <div className="studio-fix-counts">
          <span className="studio-fix-count pending">● {counts.pending} pending</span>
          <span className="studio-fix-count applied">● {counts.applied} applied</span>
          <span className="studio-fix-count skipped">● {counts.skipped} skipped</span>
        </div>
        {currentStepId && (
          <button
            type="button"
            className={`studio-fix-filter-toggle${onlyThisStep ? ' active' : ''}`}
            onClick={() => setOnlyThisStep((v) => !v)}
          >
            {onlyThisStep ? '✓ 僅本卡' : '僅本卡'}
          </button>
        )}
      </div>

      {/* List */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '8px 0',
        }}
      >
        {visibleIntents.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              color: 'color-mix(in srgb, var(--color-text-on-dark) 45%, transparent)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {onlyThisStep ? '這張卡還沒有 fix。' : '尚無修正記錄。'}
          </div>
        ) : (
          visibleIntents.map((intent) => {
            const status = getStatus(intent, skipped);
            const itemClass = status === 'skipped' ? ' studio-fix-item-skipped' : '';
            return (
              <div
                key={intent.id}
                className={itemClass}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--color-border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {/* Row: badge + stepId + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: KIND_BADGE_COLORS[intent.feedback.kind] ?? '#555',
                      color: 'var(--color-bg-dark)',
                      borderRadius: 3,
                      padding: '1px 5px',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                    }}
                  >
                    {KIND_LABELS[intent.feedback.kind] ?? intent.feedback.kind}
                  </span>
                  {hasAttachment(intent) && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: 'var(--color-info)',
                        color: 'var(--color-bg-dark)',
                        borderRadius: 3,
                        padding: '1px 5px',
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}
                      title="這條 review intent 附有圖片，處理前請先閱讀附件內容。"
                    >
                      附圖
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'color-mix(in srgb, var(--color-text-on-dark) 65%, transparent)',
                      fontFamily: 'var(--font-code, monospace)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {intent.target.stepId === EPISODE_SCOPE_ID ? '整集' : intent.target.stepId}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding: '2px 6px',
                      borderRadius: 4,
                      color:
                        status === 'applied'
                          ? 'var(--color-positive)'
                          : status === 'skipped'
                            ? 'color-mix(in srgb, var(--color-text-on-dark) 55%, transparent)'
                            : 'var(--color-warning)',
                      background:
                        status === 'applied'
                          ? 'color-mix(in srgb, var(--color-positive) 20%, transparent)'
                          : status === 'skipped'
                            ? 'color-mix(in srgb, var(--color-text-on-dark) 6%, transparent)'
                            : 'color-mix(in srgb, var(--color-warning) 16%, transparent)',
                      flexShrink: 0,
                    }}
                  >
                    {status}
                  </span>
                </div>

                {/* Message */}
                <div
                  style={{
                    fontSize: 12,
                    color: 'color-mix(in srgb, var(--color-text-on-dark) 82%, transparent)',
                    lineHeight: 1.4,
                    textDecoration: status === 'applied' ? 'line-through' : 'none',
                  }}
                >
                  {truncate(intent.feedback.message, 80)}
                </div>
                {hasAttachment(intent) && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-info)',
                      lineHeight: 1.4,
                    }}
                  >
                    先讀附件，再判斷它是修正依據、參考圖，還是實際要放進影片的素材。
                  </div>
                )}
                {status !== 'applied' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                    <button
                      type="button"
                      className="studio-fix-mini"
                      title={status === 'pending' ? '標記為略過 (skipped)' : '恢復 pending'}
                      onClick={() => toggleSkip(intent.id)}
                    >
                      ↻
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer — batch apply */}
      <div className="studio-sidebar-footer">
        <button
          type="button"
          className="studio-sidebar-batch-btn"
          disabled={counts.pending === 0}
          onClick={handleBatchApply}
          title="通知 Claude Code 套用所有 pending fix"
        >
          套用 {counts.pending} 筆 pending → Claude Code
        </button>
      </div>

      {toast && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 64,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--color-info) 36%, var(--color-overlay-bg))',
            fontSize: 12,
            color: 'var(--color-text-on-dark)',
            boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
          }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
};

export default FixListSidebar;
