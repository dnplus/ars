import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Img } from 'remotion';
import type {
  StudioIntentAnchorMeta,
  StudioIntentAnchorType,
  StudioIntentFeedback,
  StudioIntentSource,
} from '../../../types/studio-intent';
import { INTENT_SUBMITTED_EVENT } from '../constants';

export type ActionBarAnchor = {
  type: StudioIntentAnchorType;
  id: string;
  meta?: StudioIntentAnchorMeta;
};

type ActionBarProps = {
  series: string;
  epId: string;
  kind: StudioIntentFeedback['kind'];
  anchor: ActionBarAnchor;
  source?: StudioIntentSource['ui'];
};

type ToastState = {
  tone: 'success' | 'error';
  message: string;
};

type StudioIntentResponse = {
  ok: boolean;
  intent?: { id: string };
  error?: string;
};

type PopupPos = { top: number; left: number };
type AttachmentState = {
  dataUrl: string;
  name: string;
};

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export const ActionBar: React.FC<ActionBarProps> = ({ series, epId, kind, anchor, source = 'studio' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [popupPos, setPopupPos] = useState<PopupPos>({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const calcPopupPos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupW = 300;
    const popupH = 160;

    let top = rect.bottom + 8;
    let left = rect.left;

    if (top + popupH > window.innerHeight - 16) {
      top = rect.top - popupH - 8;
    }
    if (left + popupW > window.innerWidth - 16) {
      left = rect.right - popupW;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setPopupPos({ top, left });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setAttachment(null);
      calcPopupPos();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, calcPopupPos]);

  // Reset on anchor change
  useEffect(() => {
    setIsOpen(false);
    setMessage('');
    setAttachment(null);
  }, [anchor.id, anchor.type]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) { textareaRef.current?.focus(); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/__ars/studio-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: source,
          series,
          epId,
          anchorType: anchor.type,
          anchorId: anchor.id,
          anchorMeta: anchor.meta,
          stepId: anchor.type === 'step' ? anchor.id : undefined,
          kind,
          severity: 'medium',
          message: message.trim(),
          attachments: attachment ? { screenshotDataUrl: attachment.dataUrl } : undefined,
        }),
      });
      const payload = (await res.json()) as StudioIntentResponse;
      if (!res.ok || !payload.intent) throw new Error(payload.error ?? `${res.status}`);
      setToast({ tone: 'success', message: `已記錄 ${payload.intent.id}` });
      setIsOpen(false);
      setAttachment(null);
      window.dispatchEvent(new CustomEvent(INTENT_SUBMITTED_EVENT));
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  }, [message, attachment, series, epId, anchor, kind, source]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
      return;
    }

    event.preventDefault();

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setToast({ tone: 'error', message: '貼上的圖片太大，請控制在 8MB 內。' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setToast({ tone: 'error', message: '無法讀取貼上的圖片。' });
        return;
      }

      setAttachment({
        dataUrl,
        name: file.name || `pasted-${Date.now()}.png`,
      });
      setToast({ tone: 'success', message: '已附加貼上的圖片。' });
    };
    reader.onerror = () => {
      setToast({ tone: 'error', message: '無法讀取貼上的圖片。' });
    };
    reader.readAsDataURL(file);
  }, []);

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
          background: isOpen ? 'color-mix(in srgb, var(--color-warning) 22%, var(--color-overlay-bg))' : 'var(--color-overlay-bg)',
          border: `1px solid ${isOpen ? 'var(--color-warning)' : 'var(--color-border-light)'}`,
          borderRadius: 8,
          color: 'var(--color-text-on-dark)',
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
          background: 'var(--color-overlay-bg)',
          border: '1px solid var(--color-border-light)',
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
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="描述要修正的內容… 可直接貼上圖片。（⌘↵ 送出）"
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border-light)',
              background: 'color-mix(in srgb, var(--color-text-on-dark) 5%, transparent)',
              color: 'var(--color-text-on-dark)',
              fontSize: 13,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
          {attachment ? (
            <div
              style={{
                borderRadius: 10,
                border: '1px solid var(--color-border-light)',
                background: 'color-mix(in srgb, var(--color-text-on-dark) 4%, transparent)',
                padding: 10,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <Img
                src={attachment.dataUrl}
                alt={attachment.name}
                style={{
                  width: 54,
                  height: 54,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-light)',
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-on-dark)',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  已附圖
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachment.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-light)',
                  background: 'transparent',
                  color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                移除
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: 'color-mix(in srgb, var(--color-text-on-dark) 58%, transparent)',
                lineHeight: 1.5,
              }}
            >
              需要補圖時可直接在輸入框貼上一張圖片，studio intent 會自動保存附件。
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border-light)', background: 'transparent', color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)', cursor: 'pointer', fontSize: 12 }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #c4a77d)', color: 'var(--color-bg-dark)', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: isSubmitting || !message.trim() ? 0.5 : 1 }}
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
          color: 'var(--color-text-on-dark)',
          background: toast.tone === 'success'
            ? 'color-mix(in srgb, var(--color-positive) 36%, var(--color-overlay-bg))'
            : 'color-mix(in srgb, var(--color-negative) 36%, var(--color-overlay-bg))',
          zIndex: 9001,
        }} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ActionBar;
