/**
 * @component SelectMode
 * @description Element-picking overlay for canvas annotations. When `active`,
 *              intercepts mousemove over the canvas to outline the element
 *              under the cursor, then on click freezes the selection and opens
 *              a popover to capture a note + category. Submits a StudioIntent
 *              with anchorMeta describing the picked element (either a
 *              `data-annotatable` kind + label, or a heuristic tag/class
 *              fallback) and a normalized bbox for future "roughly here" hints.
 *
 *              The overlay is pointer-events: none *except* when active, so
 *              pin/click-to-pin behavior in PinLayer stays unaffected.
 *
 *              Flow:
 *                hover  -> highlight element (gold for annotatable, dashed for heuristic)
 *                click  -> freeze + open popover (note + category + annotation kind)
 *                submit -> POST /__ars/studio-intent, close mode
 *                Esc    -> cancel, close mode
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioIntentFeedback, StudioIntentSource } from '../../../types/studio-intent';
import { INTENT_SUBMITTED_EVENT } from '../constants';

// Auto-derive the backend `kind` from the picked element's [data-annotatable]
// tag. Heuristic fallbacks were proven useless inside Remotion's Player (all
// content renders as class-less <div>s), so we skip the manual category dropdown
// entirely — the TUI side can re-classify from anchorMeta.title anyway.
const ANNOTATION_TO_KIND: Record<string, StudioIntentFeedback['kind']> = {
  subtitle: 'content',
  heading: 'content',
  paragraph: 'content',
  list: 'content',
  quote: 'content',
  table: 'content',
  'code-block': 'content',
  'cover-title': 'content',
  'cover-subtitle': 'content',
  'cover-tag': 'content',
  audio: 'other',
  card: 'visual',
};

function deriveKind(annotation: string): StudioIntentFeedback['kind'] {
  return ANNOTATION_TO_KIND[annotation] ?? 'visual';
}

type SelectModeProps = {
  active: boolean;
  onExit: () => void;
  canvasEl: HTMLElement | null;
  stepId: string;
  series: string;
  epId: string;
  source?: StudioIntentSource['ui'];
  sourceHash?: string;
  placeholder?: (label: string) => string;
};

type PickedElement = {
  el: HTMLElement;
  label: string;
  /** The raw `data-annotatable` value (e.g. `subtitle`, `heading`). */
  annotation: string;
  /** Optional context string attached via `data-annotatable-context` —
   *  used e.g. to ship the step's narration text alongside an audio comment
   *  so Claude Code can fix a reading without needing to re-look-up. */
  context: string | null;
  /** Pixel rect relative to the viewport. */
  rect: DOMRect;
  /** Normalized bbox relative to the (unscaled) canvas: {x,y,w,h} in [0,1]. */
  bbox: { x: number; y: number; w: number; h: number };
};

type StudioIntentResponse = {
  ok: boolean;
  intent?: { id: string };
  error?: string;
};

type AttachmentState = {
  dataUrl: string;
  name: string;
};

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/**
 * Walk up from the cursor hit element, returning the nearest ancestor marked
 * with [data-annotatable]. Returns null when nothing annotatable is under the
 * pointer — callers should treat that as "no-op". Heuristics by tag/class were
 * removed because Remotion's <Player> renders everything as class-less divs,
 * so the fallback always resolved to the canvas root.
 */
function pickAnnotatable(x: number, y: number, canvasEl: HTMLElement): PickedElement | null {
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof HTMLElement)) return null;
  if (!canvasEl.contains(hit)) return null;
  let cursor: HTMLElement | null = hit;
  while (cursor && canvasEl.contains(cursor)) {
    if (cursor.hasAttribute('data-annotatable')) {
      const annotation = cursor.getAttribute('data-annotatable') ?? 'element';
      const label = cursor.getAttribute('data-annotatable-label') ?? annotation;
      const contextAttr = cursor.getAttribute('data-annotatable-context');
      return {
        el: cursor,
        label,
        annotation,
        context: contextAttr && contextAttr.trim().length > 0 ? contextAttr : null,
        rect: cursor.getBoundingClientRect(),
        bbox: rectToBbox(cursor.getBoundingClientRect(), canvasEl.getBoundingClientRect()),
      };
    }
    cursor = cursor.parentElement;
  }
  return null;
}

function rectToBbox(
  rect: DOMRect,
  canvasRect: DOMRect,
): { x: number; y: number; w: number; h: number } {
  const w = canvasRect.width || 1;
  const h = canvasRect.height || 1;
  return {
    x: clamp01((rect.left - canvasRect.left) / w),
    y: clamp01((rect.top - canvasRect.top) / h),
    w: clamp01(rect.width / w),
    h: clamp01(rect.height / h),
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export const SelectMode: React.FC<SelectModeProps> = ({
  active,
  onExit,
  canvasEl,
  stepId,
  series,
  epId,
  source = 'review',
  sourceHash,
  placeholder,
}) => {
  const [hover, setHover] = useState<PickedElement | null>(null);
  const [frozen, setFrozen] = useState<PickedElement | null>(null);
  const [note, setNote] = useState('');
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Reset on deactivate / step change.
  useEffect(() => {
    if (!active) {
      setHover(null);
      setFrozen(null);
      setNote('');
      setAttachment(null);
      setError(null);
    }
  }, [active]);
  useEffect(() => {
    setFrozen(null);
    setNote('');
    setAttachment(null);
  }, [stepId]);

  // Esc to exit.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (frozen) setFrozen(null);
        else onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, frozen, onExit]);

  // Track hover in capture phase at the window level. Remotion Player internals
  // can intercept bubbling mouse events, while click picking already uses
  // capture; keeping hover on the same side makes the outline appear before
  // the user clicks.
  useEffect(() => {
    if (!active || !canvasEl || frozen) return;

    const onMove = (e: MouseEvent) => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setHover(pickAnnotatable(e.clientX, e.clientY, canvasEl));
      });
    };

    window.addEventListener('mousemove', onMove, { capture: true });
    return () => {
      window.removeEventListener('mousemove', onMove, { capture: true });
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, canvasEl, frozen]);

  // Click handler — capture-phase so we win the click before other handlers
  // (e.g. PinLayer) can act.
  useEffect(() => {
    if (!active || !canvasEl) return;

    const onClickCapture = (e: MouseEvent) => {
      if (frozen) return; // popover open, ignore background clicks
      const picked = pickAnnotatable(e.clientX, e.clientY, canvasEl);
      if (!picked) return;
      e.preventDefault();
      e.stopPropagation();
      setFrozen(picked);
    };

    canvasEl.addEventListener('click', onClickCapture, { capture: true });
    return () => canvasEl.removeEventListener('click', onClickCapture, { capture: true });
  }, [active, canvasEl, frozen]);

  const commit = useCallback(async () => {
    if (!frozen || !note.trim()) return;
    setSubmitting(true);
    setError(null);
    const kind = deriveKind(frozen.annotation);
    const hashParts = [
      `pick:${frozen.annotation}`,
      `bbox:${frozen.bbox.x.toFixed(3)},${frozen.bbox.y.toFixed(3)},${frozen.bbox.w.toFixed(3)},${frozen.bbox.h.toFixed(3)}`,
    ];
    // For audio annotations the narration text rides along so Claude Code has
    // enough context to fix a reading without having to look up the step. We
    // ship it inside the message body under a recognizable marker; downstream
    // parsers can `split('\n---context---\n')` to recover it.
    const fullMessage = frozen.context
      ? `${note.trim()}\n---context---\n${frozen.context}`
      : note.trim();
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
          stepId,
          anchorMeta: { title: `pick · ${frozen.label}`, hash: hashParts.join('|') },
          kind,
          severity: 'medium',
          message: fullMessage,
          attachments: attachment ? { screenshotDataUrl: attachment.dataUrl } : undefined,
        }),
      });
      const payload = (await res.json()) as StudioIntentResponse;
      if (!res.ok || !payload.intent) throw new Error(payload.error ?? `${res.status}`);
      window.dispatchEvent(new CustomEvent(INTENT_SUBMITTED_EVENT));
      setFrozen(null);
      setNote('');
      setAttachment(null);
      onExit();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [frozen, note, attachment, source, sourceHash, series, epId, stepId, onExit]);

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
      setError('貼上的圖片太大，請控制在 8MB 內。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setError('無法讀取貼上的圖片。');
        return;
      }

      setAttachment({
        dataUrl,
        name: file.name || `pasted-${Date.now()}.png`,
      });
      setError(null);
    };
    reader.onerror = () => {
      setError('無法讀取貼上的圖片。');
    };
    reader.readAsDataURL(file);
  }, []);

  if (!active) return null;

  const activeTarget = frozen ?? hover;
  const rect = activeTarget?.rect;
  // Clamp popover to viewport: prefer below, flip above when overflowing bottom,
  // then clamp left so it never runs off the right edge.
  const POPOVER_W = 360;
  const POPOVER_MAX_H = 260;
  const GAP = 12;
  const EDGE = 12;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const popover = (() => {
    if (!frozen) return null;
    const r = frozen.rect;
    let top = r.bottom + GAP;
    if (top + POPOVER_MAX_H > vh - EDGE) {
      // Flip above. If still overflowing (tall element), pin to viewport top.
      top = Math.max(EDGE, r.top - GAP - POPOVER_MAX_H);
    }
    let left = r.left;
    if (left + POPOVER_W > vw - EDGE) left = vw - POPOVER_W - EDGE;
    if (left < EDGE) left = EDGE;
    return { top, left };
  })();

  return (
    <>
      {/* Hint chip */}
      <div className="studio-select-hint">
        {frozen ? '留言中 · 點空白處取消' : '點擊要留言的元素 · Esc 退出'}
      </div>

      {/* Backdrop: when a popover is open, a transparent layer catches clicks
          outside both the popover and the highlighted element. Clicking
          anywhere on the backdrop cancels the frozen selection. If the click
          landed over a different canvas element, immediately re-pick so the
          user doesn't have to click twice to switch targets. */}
      {frozen && (
        <div
          onClick={(e) => {
            setFrozen(null);
            setNote('');
            setAttachment(null);
            if (!canvasEl) return;
            const picked = pickAnnotatable(e.clientX, e.clientY, canvasEl);
            // Only re-pick if the click landed on a *different* annotatable;
            // clicking the same element or empty area just cancels.
            if (!picked || picked.el === frozen.el) return;
            setFrozen(picked);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9890,
            background: 'transparent',
            cursor: 'default',
          }}
        />
      )}

      {/* Outline rectangle over hovered/frozen element. Positioned in
          viewport coords so it stays pixel-accurate regardless of canvas
          scale. */}
      {rect && (
        <div
          className={`studio-select-outline annotatable${frozen ? ' frozen' : ''}`}
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            pointerEvents: 'none',
            zIndex: 9900,
          }}
        >
          <span className="studio-select-outline-label">{activeTarget?.label}</span>
        </div>
      )}

      {/* Popover */}
      {frozen && popover && (
        <div
          className="studio-select-popover"
          style={{
            position: 'fixed',
            top: popover.top,
            left: popover.left,
            zIndex: 9910,
            maxHeight: POPOVER_MAX_H,
            overflow: 'auto',
          }}
          // Block clicks from escaping to the backdrop (which would cancel).
          onClick={(e) => e.stopPropagation()}
        >
          <div className="studio-select-popover-title">
            <span className="studio-select-badge annotatable">ELEMENT</span>
            <span>{frozen.label}</span>
          </div>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') setFrozen(null);
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void commit();
            }}
            placeholder={placeholder ? placeholder(frozen.label) : `對「${frozen.label}」留言… 可直接貼圖（⌘↵ 送出）`}
          />
          {attachment && (
            <div className="studio-select-attachment">
              {/* Native <img> is correct here because this preview lives in the Studio DOM overlay, not a Remotion composition. */}
              {/* eslint-disable-next-line @remotion/warn-native-media-tag */}
              <img src={attachment.dataUrl} alt={attachment.name} />
              <div className="studio-select-attachment-meta">
                <strong>已附圖</strong>
                <span>{attachment.name}</span>
              </div>
              <button
                type="button"
                className="studio-pin-popover-btn"
                onClick={() => setAttachment(null)}
              >
                移除
              </button>
            </div>
          )}
          <div className="studio-pin-popover-row">
            <button
              type="button"
              className="studio-pin-popover-btn"
              onClick={() => setFrozen(null)}
            >
              重選
            </button>
            <button
              type="button"
              className="studio-pin-popover-btn primary"
              onClick={() => void commit()}
              disabled={submitting || !note.trim()}
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
      )}
    </>
  );
};

export default SelectMode;
