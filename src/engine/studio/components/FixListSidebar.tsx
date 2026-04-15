/**
 * @component FixListSidebar
 * @description 顯示 review intents fix list，每 5 秒 poll 一次
 */
import React, { useEffect, useState } from 'react';
import type { ReviewIntent } from '../../../types/review-intent';

type FixListSidebarProps = {
  onClose: () => void;
};

type ReviewIntentsResponse = {
  ok: boolean;
  intents: ReviewIntent[];
};

const KIND_BADGE_COLORS: Record<string, string> = {
  visual: '#7c6af5',
  content: '#3aa76d',
  other: '#888',
  timing: '#d98c2a',
};

const truncate = (str: string, max: number): string =>
  str.length > max ? `${str.slice(0, max)}…` : str;

export const FixListSidebar: React.FC<FixListSidebarProps> = ({ onClose }) => {
  const [intents, setIntents] = useState<ReviewIntent[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchIntents = async () => {
      try {
        const res = await fetch('/__ars/review-intents');
        if (!res.ok) return;
        const payload = (await res.json()) as ReviewIntentsResponse;
        if (!cancelled && payload.ok) {
          setIntents(payload.intents);
        }
      } catch {
        // ignore
      }
    };

    void fetchIntents();
    const timer = window.setInterval(() => void fetchIntents(), 5000);
    window.addEventListener('ars:intent-submitted', fetchIntents);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('ars:intent-submitted', fetchIntents);
    };
  }, []);

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        background: '#1a1a2e',
        borderLeft: '1px solid var(--color-border, #333)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        fontFamily: 'var(--font-main, sans-serif)',
        color: '#e0e0e0',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border, #333)',
          background: '#16213e',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-primary, #7c6af5)' }}>
          修正清單
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          style={{
            background: 'none',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* List */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '8px 0',
        }}
      >
        {intents.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              color: '#666',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            尚無修正記錄。
          </div>
        ) : (
          intents.map((intent) => (
            <div
              key={intent.id}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #222',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {/* Row: badge + stepId + status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: KIND_BADGE_COLORS[intent.feedback.kind] ?? '#555',
                    color: '#fff',
                    borderRadius: 3,
                    padding: '1px 5px',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                  }}
                >
                  {({'visual': '卡片', 'content': '口播', 'other': '整集', 'timing': '時序'} as Record<string, string>)[intent.feedback.kind] ?? intent.feedback.kind}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#aaa',
                    fontFamily: 'var(--font-code, monospace)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {intent.target.stepId === '__episode__' ? '整集' : intent.target.stepId}
                </span>
                {intent.processedAt ? (
                  <span style={{ fontSize: 11, color: '#777', flexShrink: 0 }}>✓ 已修正</span>
                ) : (
                  <span style={{ fontSize: 11, color: '#d4a017', flexShrink: 0 }}>待處理</span>
                )}
              </div>

              {/* Message */}
              <div
                style={{
                  fontSize: 12,
                  color: '#ccc',
                  lineHeight: 1.4,
                }}
              >
                {truncate(intent.feedback.message, 80)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FixListSidebar;
