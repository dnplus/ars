/**
 * @component PinLayer
 * @description Positional-pin overlay for the review canvas. A pin is a
 *              normalized [0,1] coordinate tied to a specific step. Clicking
 *              bare canvas creates a draft pin; the popover gathers a note +
 *              category and commits to a StudioIntent with
 *              `anchorMeta.hash = "pin:x.xxx,y.yyy"` so the TUI side can recover
 *              the position when it applies fixes.
 *
 *              The layer lives INSIDE the scaled canvas, so pin positions are
 *              invariant under window resizing — only their rendered size stays
 *              fixed via counter-scale on the pin itself.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  StudioIntentFeedback,
  StudioIntentSource,
} from '../../../types/studio-intent';
import { INTENT_SUBMITTED_EVENT } from '../constants';

type UICategory = 'visual' | 'copy' | 'timing' | 'audio' | 'other';

const UI_CATEGORY_TO_KIND: Record<UICategory, StudioIntentFeedback['kind']> = {
  visual: 'visual',
  copy: 'content',
  timing: 'timing',
  audio: 'other',
  other: 'other',
};

const CATEGORIES: UICategory[] = ['visual', 'copy', 'timing', 'audio', 'other'];

export type CommittedPin = {
  id: string;
  x: number;
  y: number;
  num: number;
  status: 'pending' | 'applied' | 'skipped';
};

type DraftPin = {
  x: number;
  y: number;
  note: string;
  cat: UICategory;
};

type PinLayerProps = {
  series: string;
  epId: string;
  stepId: string;
  source?: StudioIntentSource['ui'];
  sourceHash?: string;
  placeholder?: string;
  scale: number;
  pins: CommittedPin[];
  /** When true, the whole layer becomes pointer-transparent so another overlay
   *  (e.g. SelectMode) can receive clicks through to the canvas content. */
  disabled?: boolean;
};

const MIN_HIT = 0;
const MAX_HIT = 1;

type StudioIntentResponse = {
  ok: boolean;
  intent?: { id: string };
  error?: string;
};

export const PinLayer: React.FC<PinLayerProps> = ({
  series,
  epId,
  stepId,
  source = 'review',
  sourceHash,
  placeholder = '這一點想怎麼改？',
  scale,
  pins,
  disabled = false,
}) => {
  const [draft, setDraft] = useState<DraftPin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft when user navigates to a new step.
  useEffect(() => {
    setDraft(null);
    setError(null);
  }, [stepId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    // If the click started inside an editable element, don't drop a pin.
    const target = e.target as HTMLElement;
    if (target.closest('[data-editable="true"]')) return;
    if (target.closest('.studio-pin')) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < MIN_HIT || x > MAX_HIT || y < MIN_HIT || y > MAX_HIT) return;
    setDraft({ x, y, note: '', cat: 'visual' });
    setError(null);
  }, [disabled]);

  const commit = useCallback(async () => {
    if (!draft || !draft.note.trim()) return;
    setSubmitting(true);
    setError(null);
    const kind = UI_CATEGORY_TO_KIND[draft.cat];
    const hash = `pin:${draft.x.toFixed(3)},${draft.y.toFixed(3)}`;
    try {
      const res = await fetch('/__ars/studio-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: source,
          hash: sourceHash,
          series,
          epId,
          anchorType: 'step',
          anchorId: stepId,
          anchorMeta: { hash, title: `pin · ${draft.cat}` },
          stepId,
          kind,
          severity: 'medium',
          message: draft.note.trim(),
        }),
      });
      const payload = (await res.json()) as StudioIntentResponse;
      if (!res.ok || !payload.intent) throw new Error(payload.error ?? `${res.status}`);
      setDraft(null);
      window.dispatchEvent(new CustomEvent(INTENT_SUBMITTED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [draft, series, epId, stepId, source, sourceHash]);

  // Counter-scale pins so they stay a constant size on screen regardless of
  // canvas transform. Children pins are rendered at native 1:1 but multiplied
  // by (1/scale) so the 36px disc is still 36px to the user.
  const pinStyle: React.CSSProperties = useMemo(() => {
    const inv = scale > 0 ? 1 / scale : 1;
    return { transform: `translate(-50%, -50%) scale(${inv})`, transformOrigin: 'center' };
  }, [scale]);

  // Root is always pointer-events: none so `document.elementFromPoint` can reach
  // the underlying card content. Individual pins + the draft popover opt back
  // in via `pointer-events: auto`. The canvas-level click handler in ReviewView
  // takes care of the "click empty area → drop pin" gesture.
  return (
    <div
      className="studio-pin-layer"
      data-pin-click-zone={disabled ? undefined : 'true'}
      onClick={handleClick}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      {pins.map((p) => (
        <div
          key={p.id}
          className={`studio-pin ${p.status}`}
          style={{
            ...pinStyle,
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
          }}
          title={`pin ${p.num} · ${p.status}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="studio-pin-num">{p.num}</span>
        </div>
      ))}
      {draft && (
        <div
          className="studio-pin draft"
          style={{
            ...pinStyle,
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="studio-pin-num">?</span>
          <div
            className="studio-pin-popover"
            onClick={(e) => e.stopPropagation()}
            // The popover is rendered inside the scaled canvas; cancel the
            // counter-scale so its content doesn't get double-scaled.
            style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top left' }}
          >
            <textarea
              autoFocus
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setDraft(null);
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void commit();
              }}
              placeholder={placeholder}
            />
            <div className="studio-pin-popover-row">
              <select
                value={draft.cat}
                onChange={(e) => setDraft({ ...draft, cat: e.target.value as UICategory })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="studio-pin-popover-btn"
                onClick={() => setDraft(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="studio-pin-popover-btn primary"
                onClick={() => void commit()}
                disabled={submitting || !draft.note.trim()}
              >
                {submitting ? '…' : '送出'}
              </button>
            </div>
            {error && (
              <div style={{ marginTop: 8, color: 'var(--color-negative, #8b5e3c)', fontSize: 12 }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PinLayer;
