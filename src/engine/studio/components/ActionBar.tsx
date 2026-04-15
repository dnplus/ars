import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewIntentFeedback } from '../../../types/review-intent';
import { INTENT_SUBMITTED_EVENT } from '../constants';

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

type PopupPos = { top: number; left: number };

export const ActionBar: React.FC<ActionBarProps> = ({ stepId, series, epId, kind }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [popupPos, setPopupPos] = useState<PopupPos>({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const calcPopupPos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupW = 300;
    const popupH = 160; // estimated

    let top = rect.bottom + 8;
    let left = rect.left;

    // 如果往下超出畫面，改往上
    if (top + popupH > window.innerHeight - 16) {
      top = rect.top - popupH - 8;
    }
    // 如果往右超出畫面，靠右對齊按鈕
    if (left + popupW > window.innerWidth - 16) {
      left = rect.right - popupW;
    }
    // 不要超出左邊
    if (left < 8) left = 8;
    // 不要超出上面
    if (top < 8) top = 8;

    setPopupPos({ top, left });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      calcPopupPos();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, calcPopupPos]);

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
        body: JSON.stringify({ from: 'studio', series, epId, stepId, kind, severity: 'medium', message: message.trim() }),
      });
      const payload = (await res.json()) as ReviewIntentResponse;
      if (!res.ok || !payload.intent) throw new Error(payload.error ?? `${res.status}`);
      setToast({ tone: 'success', message: `已記錄 ${payload.intent.id}` });
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent(INTENT_SUBMITTED_EVENT));
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
        ref={buttonRef}
        onClick={() => setIsOpen((v) => !v)}
        title="標記修正"
        style={{
          background: isOpen ? 'rgba(255,200,0,0.22)' : 'rgba(0,0,0,0.75)',
          border: `1px solid ${isOpen ? 'rgba(255,200,0,0.6)' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 8,
          color: '#fff',
          fontSize: 18,
          width: 40,
          height: 40,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✨
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          top: popupPos.top,
          left: popupPos.left,
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
          zIndex: 9000,
        }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述要修正的內容…（⌘↵ 送出）"
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
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #c4a77d)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: isSubmitting || !message.trim() ? 0.5 : 1 }}
            >
              {isSubmitting ? '…' : '送出'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          top: popupPos.top,
          left: popupPos.left,
          minWidth: 200,
          padding: '10px 14px',
          borderRadius: 10,
          fontSize: 12,
          color: '#fff',
          background: toast.tone === 'success' ? 'rgba(13,103,62,0.96)' : 'rgba(145,32,52,0.96)',
          zIndex: 9001,
        }} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
