import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Step } from '../../shared/types';

type StepEditorPanelProps = {
  step: Step;
  sourceStep: Step;
  sourceFilePath?: string;
  sourceStartLine?: number;
  onApply: (nextStep: Step) => void;
  onReset: () => void;
  onClose: () => void;
};

const formatStep = (step: Step) => JSON.stringify(step, null, 2);
const EDITOR_FONT_SIZE = 12;
const EDITOR_LINE_HEIGHT = 1.6;
const EDITOR_LINE_HEIGHT_PX = EDITOR_FONT_SIZE * EDITOR_LINE_HEIGHT;
const EDITOR_HORIZONTAL_PADDING = 24;

type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct' | 'text';
type Token = { type: TokenType; value: string };

function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  const re = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])|([^\S\n]+|\n)|([^\s"{}[\],:]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(json)) !== null) {
    const [, key, str, boolNull, num, punct, ws, other] = match;
    if (key) tokens.push({ type: 'key', value: key });
    else if (str) tokens.push({ type: 'string', value: str });
    else if (boolNull) tokens.push({ type: boolNull === 'null' ? 'null' : 'boolean', value: boolNull });
    else if (num) tokens.push({ type: 'number', value: num });
    else if (punct) tokens.push({ type: 'punct', value: punct });
    else if (ws) tokens.push({ type: 'text', value: ws });
    else if (other) tokens.push({ type: 'text', value: other });
  }
  return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  key: '#d2a8ff',
  string: '#a5d6ff',
  number: '#f0883e',
  boolean: '#f0883e',
  null: '#f0883e',
  punct: 'rgba(255,255,255,0.35)',
  text: 'inherit',
};

const isStepLike = (value: unknown): value is Step => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.contentType === 'string' &&
    typeof candidate.narration === 'string' &&
    typeof candidate.durationInSeconds === 'number'
  );
};

export const StepEditorPanel: React.FC<StepEditorPanelProps> = ({
  step,
  sourceStep,
  sourceFilePath,
  sourceStartLine,
  onApply,
  onReset,
  onClose,
}) => {
  const [draft, setDraft] = useState(() => formatStep(step));
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editorContentWidth, setEditorContentWidth] = useState(0);
  const [visualLineCounts, setVisualLineCounts] = useState<number[]>([]);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(formatStep(step));
    setError(null);
    setIsDirty(false);
  }, [step]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const updateWidth = () => {
      setEditorContentWidth(Math.max(0, textarea.clientWidth - EDITOR_HORIZONTAL_PADDING));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(textarea);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const sourceJson = useMemo(() => formatStep(sourceStep), [sourceStep]);

  useEffect(() => {
    const measureEl = measureRef.current;
    if (!measureEl || editorContentWidth <= 0) {
      setVisualLineCounts(draft.split('\n').map(() => 1));
      return;
    }

    measureEl.style.width = `${editorContentWidth}px`;
    const nextCounts = draft.split('\n').map((line) => {
      measureEl.textContent = line.length > 0 ? line : ' ';
      const measuredHeight = measureEl.getBoundingClientRect().height;
      return Math.max(1, Math.round(measuredHeight / EDITOR_LINE_HEIGHT_PX));
    });

    setVisualLineCounts(nextCounts);
  }, [draft, editorContentWidth]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(draft) as unknown;
      if (!isStepLike(parsed)) {
        throw new Error('Step JSON 至少要有 id / contentType / narration / durationInSeconds。');
      }

      onApply(parsed);
      setError(null);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetDraft = () => {
    setDraft(sourceJson);
    setError(null);
    setIsDirty(true);
  };

  return (
    <aside
      style={{
        width: 380,
        flexShrink: 0,
        background: 'var(--color-bg-dark)',
        borderLeft: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--color-text-on-dark)',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 13, color: 'var(--color-text-on-dark)' }}>Step Editor</strong>
          <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text-on-dark) 65%, transparent)' }}>
            只影響目前 studio preview，不會直接回寫 episode 檔。
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'color-mix(in srgb, var(--color-text-on-dark) 65%, transparent)',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 12,
          color: 'color-mix(in srgb, var(--color-text-on-dark) 82%, transparent)',
        }}
      >
        <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>step</span> {step.id}</div>
        <div><span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>type</span> {step.contentType}</div>
        {sourceFilePath ? (
          <div>
            <span style={{ color: 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)' }}>source</span>
            {' '}
            <span style={{ fontFamily: 'var(--font-code, monospace)', fontSize: 11 }}>
              {sourceFilePath}
              {sourceStartLine ? `:${sourceStartLine}` : ''}
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
        <div
          className="editor-container"
          style={{
            borderRadius: 12,
            border: '1px solid var(--color-border-light)',
            background: 'color-mix(in srgb, var(--color-bg-dark) 78%, black)',
            overflow: 'hidden',
            position: 'relative',
            flex: 1,
            minHeight: 260,
          }}
        >
          <div
            className="editor-gutter"
            ref={gutterRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 48,
              height: '100%',
              overflowY: 'hidden',
              padding: '14px 0',
              boxSizing: 'border-box',
              textAlign: 'right',
              paddingRight: 10,
              fontFamily: 'var(--font-code, monospace)',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.25)',
              background: 'color-mix(in srgb, var(--color-bg-dark) 78%, black)',
              borderRadius: '12px 0 0 12px',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {visualLineCounts.map((lineCount, i) => (
              <React.Fragment key={i}>
                <div style={{ height: `${EDITOR_LINE_HEIGHT_PX}px`, lineHeight: `${EDITOR_LINE_HEIGHT_PX}px` }}>
                  {i + 1}
                </div>
                {Array.from({ length: Math.max(0, lineCount - 1) }).map((_, continuationIndex) => (
                  <div
                    key={`cont-${i}-${continuationIndex}`}
                    style={{ height: `${EDITOR_LINE_HEIGHT_PX}px`, lineHeight: `${EDITOR_LINE_HEIGHT_PX}px` }}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>

          <pre
            className="editor-highlight"
            ref={highlightRef}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 48,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: 14,
              paddingLeft: 10,
              overflowY: 'auto',
              overflowX: 'hidden',
              fontFamily: 'var(--font-code, monospace)',
              fontSize: EDITOR_FONT_SIZE,
              lineHeight: EDITOR_LINE_HEIGHT,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              pointerEvents: 'none',
              color: 'var(--color-text-on-dark)',
              background: 'transparent',
              borderRadius: '0 12px 12px 0',
            }}
          >
            {tokenizeJson(draft).map((token, i) => (
              <span key={i} style={{ color: TOKEN_COLORS[token.type] }}>{token.value}</span>
            ))}
          </pre>

          <textarea
            className="editor-input"
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setIsDirty(true);
            }}
            onScroll={(e) => {
              const scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
              if (highlightRef.current) {
                highlightRef.current.scrollTop = scrollTop;
              }
              if (gutterRef.current) {
                gutterRef.current.scrollTop = scrollTop;
              }
            }}
            spellCheck={false}
            style={{
              position: 'absolute',
              top: 0,
              left: 48,
              right: 0,
              bottom: 0,
              width: 'calc(100% - 48px)',
              height: '100%',
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'transparent',
              caretColor: 'white',
              padding: 14,
              paddingLeft: 10,
              fontFamily: 'var(--font-code, monospace)',
              fontSize: EDITOR_FONT_SIZE,
              lineHeight: EDITOR_LINE_HEIGHT,
              boxSizing: 'border-box',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          />

          <div
            ref={measureRef}
            aria-hidden
            style={{
              position: 'absolute',
              visibility: 'hidden',
              pointerEvents: 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              fontFamily: 'var(--font-code, monospace)',
              fontSize: EDITOR_FONT_SIZE,
              lineHeight: EDITOR_LINE_HEIGHT,
              padding: 0,
              margin: 0,
              top: 0,
              left: -99999,
            }}
          />
        </div>

        {error ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--color-negative) 24%, var(--color-overlay-bg))',
              color: 'var(--color-text-on-dark)',
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleApply}
            disabled={!isDirty}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: isDirty ? 'var(--color-primary, #c4a77d)' : 'color-mix(in srgb, var(--color-text-on-dark) 12%, transparent)',
              color: isDirty ? 'var(--color-bg-dark)' : 'color-mix(in srgb, var(--color-text-on-dark) 62%, transparent)',
              fontWeight: 700,
              cursor: isDirty ? 'pointer' : 'not-allowed',
            }}
          >
            套用到預覽
          </button>
          <button
            type="button"
            onClick={handleResetDraft}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--color-border-light)',
              background: 'transparent',
              color: 'color-mix(in srgb, var(--color-text-on-dark) 82%, transparent)',
              cursor: 'pointer',
            }}
          >
            載入原始 step
          </button>
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--color-border-light)',
              background: 'transparent',
              color: 'var(--color-negative)',
              cursor: 'pointer',
            }}
          >
            還原 preview
          </button>
        </div>
      </div>
    </aside>
  );
};

export default StepEditorPanel;
