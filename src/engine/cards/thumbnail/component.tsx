/**
 * @component ThumbnailCardComponent
 * @description YouTube Thumbnail card — 1280×720 Still composition。
 *
 * 提供兩種 export：
 * - `ThumbnailCard`：flat props，供 Root.tsx thumbnails 區塊使用
 * - `ThumbnailCardComponent`：CardRenderProps 介面，供 card registry / spec 使用
 */
import React from 'react';
import { Img } from 'remotion';
import type { CardRenderProps } from '../types';
import type { ThumbnailData } from '../../shared/types';

export type { ThumbnailData };

export type ThumbnailCardProps = ThumbnailData & {
  width?: number;
  height?: number;
  theme?: {
    primary: string;
    accent: string;
    surfaceDark: string;
    onDark: string;
  };
};

const DEFAULT_THEME = {
  primary: '#e6c373',
  accent: '#a67c29',
  surfaceDark: '#120e0a',
  onDark: '#ffffff',
};

function pickTitleFontSize(title: string, isPortrait: boolean, hasMascot: boolean): number {
  const len = title.length;
  if (isPortrait) {
    if (len <= 6) return 180;
    if (len <= 10) return 150;
    if (len <= 16) return 130;
    if (len <= 22) return 110;
    return 95;
  }
  const scale = hasMascot ? 0.8 : 1;
  if (len <= 6) return Math.round(220 * scale);
  if (len <= 10) return Math.round(180 * scale);
  if (len <= 14) return Math.round(150 * scale);
  if (len <= 20) return Math.round(125 * scale);
  if (len <= 28) return Math.round(105 * scale);
  return Math.round(88 * scale);
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  title,
  subtitle,
  channelName,
  episodeTag,
  theme: userTheme,
  mascotUrl,
  width = 1280,
  height = 720,
}) => {
  const t = { ...DEFAULT_THEME, ...userTheme };
  const isPortrait = height > width;

  const titleFontSize = pickTitleFontSize(title, isPortrait, Boolean(mascotUrl));
  const headerText = [channelName, episodeTag].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        background: t.surfaceDark,
        fontFamily: "'Noto Sans TC', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 金屬邊框底層 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `linear-gradient(135deg, ${t.accent}, ${t.primary}, #fff, ${t.primary}, ${t.accent})`,
        }}
      />

      {/* 內容背景（裁切） */}
      <div
        style={{
          position: 'absolute',
          inset: 24,
          borderRadius: 20,
          overflow: 'hidden',
          background: t.surfaceDark,
          zIndex: 1,
          boxShadow: `inset 0 0 60px ${t.accent}33, inset 0 0 120px ${t.primary}15`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse at 30% 30%, ${t.accent}30 0%, transparent 50%),
              radial-gradient(ellipse at 80% 70%, ${t.primary}25 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, ${t.surfaceDark}00 0%, ${t.surfaceDark} 80%),
              linear-gradient(160deg, #1a1008 0%, ${t.surfaceDark} 40%, #0d0500 100%)
            `,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 20px,
              ${t.primary} 20px,
              ${t.primary} 21px
            )`,
          }}
        />
      </div>

      {/* 文字層 */}
      <div
        style={{
          position: 'absolute',
          inset: 40,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: mascotUrl && !isPortrait ? 'flex-start' : 'center',
          justifyContent: 'center',
          textAlign: mascotUrl && !isPortrait ? 'left' : 'center',
          paddingRight: mascotUrl && !isPortrait ? `${Math.round(width * 0.34)}px` : 0,
          paddingBottom: mascotUrl && isPortrait ? `${Math.round(height * 0.42)}px` : 0,
        }}
      >
        {headerText && (
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 6,
              marginBottom: 20,
              textTransform: 'uppercase',
              padding: '12px 32px',
              borderRadius: 6,
              background: `linear-gradient(180deg, #c9a84c 0%, #b8943a 40%, #a68530 60%, #b8943a 100%)`,
              border: `2px solid #d4b05a`,
              borderBottom: `3px solid #7a6020`,
              color: '#4a3510',
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.35),
                inset 0 -1px 2px rgba(0,0,0,0.15),
                0 4px 0px #6a5518,
                0 6px 8px rgba(0,0,0,0.4)
              `,
              textShadow: `0 1px 0 rgba(255, 230, 160, 0.6), 0 -1px 1px rgba(0, 0, 0, 0.35)`,
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            {headerText}
          </div>
        )}

        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.1,
            margin: 0,
            textShadow: `
              0 15px 30px rgba(0, 0, 0, 0.8),
              0 0 30px ${t.primary}55,
              0 6px 0px #2a1f10
            `,
            WebkitTextStroke: `5px #2a1f10`,
            paintOrder: 'stroke fill',
            maxWidth: '100%',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            letterSpacing: titleFontSize > 140 ? -3 : -1,
          }}
        >
          {title}
        </div>

        {subtitle && (
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: t.primary,
              marginTop: 18,
              textShadow: `0 0 15px ${t.primary}55, 0 4px 8px rgba(0, 0, 0, 0.8)`,
              WebkitTextStroke: `2px #120e0a`,
              paintOrder: 'stroke fill',
              maxWidth: '100%',
              letterSpacing: 1,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* 吉祥物 */}
      {mascotUrl && (
        <div
          style={{
            position: 'absolute',
            ...(isPortrait
              ? { bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '50%' }
              : { right: 0, bottom: 0, width: '45%', height: '100%' }
            ),
            zIndex: 15,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: isPortrait ? 'center' : 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <Img
            src={mascotUrl}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: `drop-shadow(0 0 40px ${t.primary}66) drop-shadow(-10px 10px 20px rgba(0,0,0,0.8))`,
            }}
          />
        </div>
      )}
    </div>
  );
};

// ── CardRenderProps 版（供 card registry 使用） ───────────

export const ThumbnailCardComponent: React.FC<CardRenderProps<ThumbnailData>> = ({
  data,
  episode,
}) => {
  return (
    <ThumbnailCard
      title={data.title ?? episode.title}
      subtitle={data.subtitle ?? episode.subtitle}
      channelName={data.channelName ?? episode.channelName}
      episodeTag={data.episodeTag ?? episode.episodeTag}
      mascotUrl={data.mascotUrl}
      width={1280}
      height={720}
    />
  );
};
