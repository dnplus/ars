/**
 * @component FixListSidebar
 * @description 顯示 review intents fix list，每 5 秒 poll 一次
 */
import React, { useEffect, useState } from 'react';
import type { ReviewIntent } from '../../../types/review-intent';
import { EPISODE_SCOPE_ID, INTENT_SUBMITTED_EVENT, KIND_LABELS } from '../constants';

type FixListSidebarProps = {
  onClose: () => void;
};

type ReviewIntentsResponse = {
  ok: boolean;
  intents: ReviewIntent[];
};

const KIND_BADGE_COLORS: Record<string, string> = {
  visual: 'var(--color-highlight)',
  content: 'var(--color-positive)',
  other: 'var(--color-secondary)',
  timing: 'var(--color-warning)',
};

const truncate = (str: string, max: number): string =>
  str.length > max ? `${str.slice(0, max)}…` : str;

const hasAttachment = (intent: ReviewIntent): boolean =>
  !!intent.attachments?.screenshotPath || !!intent.attachments?.screenshotDataUrl;

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
    window.addEventListener(INTENT_SUBMITTED_EVENT, fetchIntents);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(INTENT_SUBMITTED_EVENT, fetchIntents);
    };
  }, []);

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--color-bg-dark)',
        borderLeft: '1px solid var(--color-border-light)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        fontFamily: 'var(--font-main, sans-serif)',
        color: 'var(--color-text-on-dark)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--color-border-light)',
          background: 'var(--color-overlay-bg)',
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
            color: 'color-mix(in srgb, var(--color-text-on-dark) 65%, transparent)',
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
              color: 'color-mix(in srgb, var(--color-text-on-dark) 45%, transparent)',
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
                borderBottom: '1px solid var(--color-border-light)',
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
                    color: 'var(--color-bg-dark)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                  }}
                >
                  {KIND_LABELS[intent.feedback.kind] ?? intent.feedback.kind}
                </span>
                {hasAttachment(intent) ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: 'var(--color-info)',
                      color: 'var(--color-bg-dark)',
                      borderRadius: 3,
                      padding: '1px 5px',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                    }}
                    title="這條 review intent 附有圖片，處理前請先閱讀附件內容。"
                  >
                    附圖
                  </span>
                ) : null}
                <span
                  style={{
                    fontSize: 11,
                    color: 'color-mix(in srgb, var(--color-text-on-dark) 65%, transparent)',
                    fontFamily: 'var(--font-code, monospace)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {intent.target.stepId === EPISODE_SCOPE_ID ? '整集' : intent.target.stepId}
                </span>
                {intent.processedAt ? (
                  <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text-on-dark) 50%, transparent)', flexShrink: 0 }}>✓ 已修正</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--color-warning)', flexShrink: 0 }}>待處理</span>
                )}
              </div>

              {/* Message */}
              <div
                style={{
                  fontSize: 12,
                  color: 'color-mix(in srgb, var(--color-text-on-dark) 82%, transparent)',
                  lineHeight: 1.4,
                }}
              >
                {truncate(intent.feedback.message, 80)}
              </div>
              {hasAttachment(intent) ? (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-info)',
                    lineHeight: 1.4,
                  }}
                >
                  先讀附件，再判斷它是修正依據、參考圖，還是實際要放進影片的素材。
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FixListSidebar;
