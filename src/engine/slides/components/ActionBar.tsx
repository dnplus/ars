import React, { useCallback, useEffect, useState } from 'react';
import type { ReviewIntent } from '../../../types/review-intent';

type ActionBarProps = {
  stepId: string;
  series: string;
  epId: string;
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

const DEFAULT_FEEDBACK_MESSAGE = 'Please review and fix this step.';

export const ActionBar: React.FC<ActionBarProps> = ({ stepId, series, epId }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestIntentId, setLatestIntentId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const pushToast = useCallback((message: string, tone: ToastState['tone']) => {
    setToast({ message, tone });
  }, []);

  const handleMarkForFix = useCallback(async () => {
    const message = window.prompt(
      'Review feedback message',
      `${DEFAULT_FEEDBACK_MESSAGE} (${series}/${epId} - ${stepId})`,
    );

    if (message === null) {
      return;
    }

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
          kind: 'other',
          severity: 'medium',
          message: message.trim(),
          hash: window.location.hash || undefined,
        }),
      });

      const payload = (await response.json()) as ReviewIntentResponse;
      if (!response.ok || !payload.intent) {
        throw new Error(payload.error || `Request failed with ${response.status}`);
      }

      setLatestIntentId(payload.intent.id);
      pushToast(`Intent created: ${payload.intent.id}`, 'success');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [epId, pushToast, series, stepId]);

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

  const handleCaptureScreenshot = useCallback(() => {
    pushToast('TODO: screenshot capture is not implemented yet.', 'info');
  }, [pushToast]);

  return (
    <div className="action-bar">
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
      >
        Capture screenshot
      </button>

      {toast && (
        <div className={`action-bar-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
