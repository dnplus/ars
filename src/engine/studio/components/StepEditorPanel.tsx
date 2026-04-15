import React, { useEffect, useMemo, useState } from 'react';
import type { Step } from '../../shared/types';

type StepEditorPanelProps = {
  step: Step;
  sourceStep: Step;
  onApply: (nextStep: Step) => void;
  onReset: () => void;
  onClose: () => void;
};

const formatStep = (step: Step) => JSON.stringify(step, null, 2);

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
  onApply,
  onReset,
  onClose,
}) => {
  const [draft, setDraft] = useState(() => formatStep(step));
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setDraft(formatStep(step));
    setError(null);
    setIsDirty(false);
  }, [step]);

  const sourceJson = useMemo(() => formatStep(sourceStep), [sourceStep]);

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
        background: '#111827',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        color: '#e5e7eb',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 13, color: '#f9fafb' }}>Step Editor</strong>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            只影響目前 studio preview，不會直接回寫 episode 檔。
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#9ca3af',
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
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 12,
          color: '#cbd5e1',
        }}
      >
        <div><span style={{ color: '#94a3b8' }}>step</span> {step.id}</div>
        <div><span style={{ color: '#94a3b8' }}>type</span> {step.contentType}</div>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setIsDirty(true);
          }}
          spellCheck={false}
          style={{
            width: '100%',
            flex: 1,
            minHeight: 260,
            resize: 'none',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#020617',
            color: '#e2e8f0',
            padding: 14,
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: 'var(--font-code, monospace)',
          }}
        />

        {error ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(127,29,29,0.35)',
              color: '#fecaca',
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
              background: isDirty ? 'var(--color-primary, #c4a77d)' : 'rgba(255,255,255,0.12)',
              color: isDirty ? '#111827' : '#94a3b8',
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
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'transparent',
              color: '#cbd5e1',
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
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'transparent',
              color: '#fca5a5',
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
