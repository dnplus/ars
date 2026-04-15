import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewIntentFeedback } from '../../../types/review-intent';

type ActionBarProps = {
  stepId: string;
  series: string;
  epId: string;
};

type PopupTarget = {
  kind: ReviewIntentFeedback['kind'];
  label: string;
};

type ToastState = {
  tone: 'success' | 'error';
  message: string;
};

type ReviewIntentResponse = {
  ok: boolean;
  intent?: { id: string };
  error?: string;
};

const POPUP_TARGETS: PopupTarget[] = [
  { kind: 'visual',   label: 'Card fix' },
  { kind: 'content',  label: 'Narration fix' },
  { kind: 'other',    label: 'Global fix' },
];

export const ActionBar: React.FC<ActionBarProps> = ({ stepId, series, epId }) => {
  const [openKind, setOpenKind] = useState<ReviewIntentFeedback['kind'] | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset message when popup opens
  useEffect(() => {
    if (openKind) {
      setMessage('');
      // Focus textarea on next tick
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [openKind]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleOpen = useCallback((kind: ReviewIntentFeedback['kind']) => {
    setOpenKind(kind);
  }, []);

  const handleClose = useCallback(() => {
    setOpenKind(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!openKind) return;
    if (!message.trim()) {
      textareaRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/__ars/review-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'slides',
          series,
          epId,
          stepId,
          kind: openKind,
          severity: 'medium',
          message: message.trim(),
        }),
      });

      const payload = (await res.json()) as ReviewIntentResponse;
      if (!res.ok || !payload.intent) {
        throw new Error(payload.error ?? `Request failed: ${res.status}`);
      }

      setToast({ tone: 'success', message: `Flagged: ${payload.intent.id}` });
      setOpenKind(null);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  }, [openKind, message, series, epId, stepId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleSubmit, handleClose],
  );

  const openTarget = POPUP_TARGETS.find((t) => t.kind === openKind);

  return (
    <div className="action-bar">
      {/* Three ⚡ buttons */}
      <div className="action-bar-row">
        {POPUP_TARGETS.map((target) => (
          <button
            key={target.kind}
            className={`action-bar-btn action-bar-flag-btn${openKind === target.kind ? ' active' : ''}`}
            onClick={() => handleOpen(target.kind)}
            type="button"
            title={target.label}
          >
            ⚡ {target.label}
          </button>
        ))}
      </div>

      {/* Popup composer */}
      {openKind && openTarget && (
        <div className="action-bar-panel">
          <div className="action-bar-panel-header">
            <span className="action-bar-panel-title">{openTarget.label}</span>
            <span className="action-bar-panel-meta">{series}/{epId} · {stepId}</span>
          </div>

          <textarea
            ref={textareaRef}
            className="action-bar-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what should change… (⌘↵ to submit)"
            rows={4}
          />

          <div className="action-bar-panel-footer">
            <button
              className="action-bar-btn subtle"
              onClick={handleClose}
              type="button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="action-bar-btn primary"
              onClick={handleSubmit}
              type="button"
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`action-bar-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
