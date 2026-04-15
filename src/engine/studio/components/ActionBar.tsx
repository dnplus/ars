import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewIntentFeedback } from '../../../types/review-intent';

type ActionBarProps = {
  stepId: string;
  series: string;
  epId: string;
  kind: ReviewIntentFeedback['kind'];
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

export const ActionBar: React.FC<ActionBarProps> = ({ stepId, series, epId, kind }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset on step change
  useEffect(() => {
    setIsOpen(false);
    setMessage('');
  }, [stepId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) { textareaRef.current?.focus(); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/__ars/review-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'slides', series, epId, stepId, kind, severity: 'medium', message: message.trim() }),
      });
      const payload = (await res.json()) as ReviewIntentResponse;
      if (!res.ok || !payload.intent) throw new Error(payload.error ?? `${res.status}`);
      setToast({ tone: 'success', message: `⚡ ${payload.intent.id}` });
      setIsOpen(false);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  }, [message, series, epId, stepId, kind]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSubmit(); }
    if (e.key === 'Escape') setIsOpen(false);
  }, [handleSubmit]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Flag for fix"
        style={{
          background: isOpen ? 'rgba(255,200,0,0.22)' : 'rgba(8,15,29,0.75)',
          border: `1px solid ${isOpen ? 'rgba(255,200,0,0.6)' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 10,
          color: '#fff',
          fontSize: 26,
          width: 48,
          height: 48,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}
      >
        ✨
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 44,
          right: 0,
          width: 300,
          background: 'rgba(8,15,29,0.96)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          backdropFilter: 'blur(18px)',
          boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
          zIndex: 200,
        }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the fix… (⌘↵ submit)"
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #c4a77d)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: isSubmitting || !message.trim() ? 0.5 : 1 }}
            >
              {isSubmitting ? '…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'absolute',
          bottom: 44,
          right: 0,
          minWidth: 200,
          padding: '10px 14px',
          borderRadius: 10,
          fontSize: 12,
          color: '#fff',
          background: toast.tone === 'success' ? 'rgba(13,103,62,0.96)' : 'rgba(145,32,52,0.96)',
          zIndex: 210,
        }} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
