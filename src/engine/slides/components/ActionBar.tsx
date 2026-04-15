import html2canvas from 'html2canvas';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ReviewIntent,
  ReviewIntentFeedback,
} from '../../../types/review-intent';

type ActionBarProps = {
  stepId: string;
  series: string;
  epId: string;
  captureTargetRef: React.RefObject<HTMLElement | null>;
};

type ToastState = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

type ReviewIntentResponse = {
  ok: boolean;
  intent?: ReviewIntent;
  error?: string;
};

type ReviewSessionEndResponse = {
  ok: boolean;
  intentCount?: number;
  error?: string;
};

const DEFAULT_KIND: ReviewIntentFeedback['kind'] = 'other';
const DEFAULT_SEVERITY: ReviewIntentFeedback['severity'] = 'medium';
const KIND_OPTIONS: ReviewIntentFeedback['kind'][] = [
  'visual',
  'content',
  'timing',
  'other',
];
const SEVERITY_OPTIONS: ReviewIntentFeedback['severity'][] = [
  'high',
  'medium',
  'low',
];

const buildDefaultMessage = (series: string, epId: string, stepId: string) =>
  `Please review and fix this step. (${series}/${epId} - ${stepId})`;

export const ActionBar: React.FC<ActionBarProps> = ({
  stepId,
  series,
  epId,
  captureTargetRef,
}) => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEndingReview, setIsEndingReview] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [latestIntentId, setLatestIntentId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [message, setMessage] = useState(buildDefaultMessage(series, epId, stepId));
  const [kind, setKind] = useState<ReviewIntentFeedback['kind']>(DEFAULT_KIND);
  const [severity, setSeverity] = useState<ReviewIntentFeedback['severity']>(DEFAULT_SEVERITY);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  const screenshotLabel = useMemo(
    () => (screenshotDataUrl ? 'Re-capture screenshot' : 'Capture screenshot'),
    [screenshotDataUrl],
  );

  useEffect(() => {
    setMessage(buildDefaultMessage(series, epId, stepId));
    setKind(DEFAULT_KIND);
    setSeverity(DEFAULT_SEVERITY);
    setScreenshotDataUrl(null);
    setIsComposerOpen(false);
  }, [epId, series, stepId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const pushToast = useCallback((nextMessage: string, tone: ToastState['tone']) => {
    setToast({ message: nextMessage, tone });
  }, []);

  const resetComposer = useCallback(() => {
    setIsComposerOpen(false);
    setMessage(buildDefaultMessage(series, epId, stepId));
    setKind(DEFAULT_KIND);
    setSeverity(DEFAULT_SEVERITY);
    setScreenshotDataUrl(null);
  }, [epId, series, stepId]);

  const handleMarkForFix = useCallback(() => {
    setIsComposerOpen(true);
  }, []);

  const handleQuickFlag = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/__ars/review-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'slides',
          series,
          epId,
          stepId,
          kind: DEFAULT_KIND,
          severity: DEFAULT_SEVERITY,
          message: buildDefaultMessage(series, epId, stepId),
          hash: window.location.hash || undefined,
        }),
      });

      const payload = (await response.json()) as ReviewIntentResponse;
      if (!response.ok || !payload.intent) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      setLatestIntentId(payload.intent.id);
      pushToast(`⚡ Flagged: ${payload.intent.id}`, 'success');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [epId, pushToast, series, stepId]);

  const handleCancelComposer = useCallback(() => {
    resetComposer();
  }, [resetComposer]);

  const handleSubmitIntent = useCallback(async () => {
    if (message.trim() === '') {
      pushToast('Feedback message is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/__ars/review-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'slides',
          series,
          epId,
          stepId,
          kind,
          severity,
          message: message.trim(),
          hash: window.location.hash || undefined,
          attachments: screenshotDataUrl
            ? { screenshotDataUrl }
            : undefined,
        }),
      });

      const payload = (await response.json()) as ReviewIntentResponse;
      if (!response.ok || !payload.intent) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      setLatestIntentId(payload.intent.id);
      pushToast(`Intent created: ${payload.intent.id}`, 'success');
      resetComposer();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    epId,
    kind,
    message,
    pushToast,
    resetComposer,
    screenshotDataUrl,
    series,
    severity,
    stepId,
  ]);

  const handleCopySceneFix = useCallback(async () => {
    if (!latestIntentId) {
      pushToast('Create an intent first.', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(`/ars:scene-fix ${latestIntentId}`);
      pushToast(`Copied /ars:scene-fix ${latestIntentId}`, 'success');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushToast(detail, 'error');
    }
  }, [latestIntentId, pushToast]);

  const handleCaptureScreenshot = useCallback(async () => {
    const captureTarget = captureTargetRef.current;

    if (!captureTarget) {
      pushToast('Slide capture target is not available.', 'error');
      return;
    }

    setIsCapturingScreenshot(true);
    try {
      const canvas = await html2canvas(captureTarget, {
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      setScreenshotDataUrl(dataUrl);
      pushToast('Screenshot captured and attached to the next intent.', 'success');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushToast(detail, 'error');
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [captureTargetRef, pushToast]);

  const handleDoneReviewing = useCallback(async () => {
    setIsEndingReview(true);
    try {
      const response = await fetch('/__ars/review-session-end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as ReviewSessionEndResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      pushToast(
        'Review session ended. Switch to Claude Code to apply fixes.',
        'success',
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushToast(detail, 'error');
    } finally {
      setIsEndingReview(false);
    }
  }, [pushToast]);

  return (
    <div className="action-bar">
      <div className="action-bar-row">
        <button
          className="action-bar-btn quick-flag"
          onClick={handleQuickFlag}
          disabled={isSubmitting}
          type="button"
          title="Quick flag this slide for review"
        >
          ⚡
        </button>
        <button
          className="action-bar-btn primary"
          onClick={handleMarkForFix}
          disabled={isSubmitting}
          type="button"
        >
          {isSubmitting ? 'Saving...' : 'Mark for fix'}
        </button>
        <button
          className="action-bar-btn"
          onClick={handleCopySceneFix}
          type="button"
        >
          Copy /ars:scene-fix command
        </button>
        <button
          className="action-bar-btn"
          onClick={handleCaptureScreenshot}
          type="button"
          disabled={isCapturingScreenshot}
        >
          {isCapturingScreenshot ? 'Capturing...' : screenshotLabel}
        </button>
        <button
          className="action-bar-btn done-reviewing"
          onClick={handleDoneReviewing}
          type="button"
          disabled={isEndingReview}
        >
          {isEndingReview ? 'Ending...' : 'Done Reviewing'}
        </button>
      </div>

      {isComposerOpen && (
        <div className="action-bar-panel">
          <div className="action-bar-panel-header">
            <div className="action-bar-panel-title">Review intent</div>
            <div className="action-bar-panel-meta">
              {series}/{epId} · {stepId}
            </div>
          </div>

          <label className="action-bar-field">
            <span className="action-bar-label">Feedback</span>
            <textarea
              className="action-bar-textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe what should change on this slide."
              rows={4}
            />
          </label>

          <div className="action-bar-field">
            <span className="action-bar-label">Kind</span>
            <div className="action-bar-chip-row">
              {KIND_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`action-bar-chip ${kind === option ? 'selected' : ''}`}
                  onClick={() => setKind(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="action-bar-field">
            <span className="action-bar-label">Severity</span>
            <div className="action-bar-chip-row">
              {SEVERITY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`action-bar-chip ${severity === option ? 'selected' : ''}`}
                  onClick={() => setSeverity(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="action-bar-panel-footer">
            <div className="action-bar-attachment-status">
              {screenshotDataUrl
                ? 'Screenshot attached'
                : 'No screenshot attached'}
            </div>
            <div className="action-bar-panel-actions">
              <button
                className="action-bar-btn subtle"
                onClick={handleCancelComposer}
                type="button"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="action-bar-btn primary"
                onClick={handleSubmitIntent}
                type="button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`action-bar-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
