/**
 * @component PhotoThumbnailCard
 * @description YouTube Thumbnail with photo background — 照片底圖 + 可配置標題位置 + 自訂邊框。
 *
 * 設計原則：
 * - 底圖填滿，文字疊在上方
 * - 漸變遮罩確保文字可讀
 * - 彩色漸變邊框讓縮圖從列表跳出
 * - 大字 + 粗描邊 = YT 縮圖標準風格
 */
import React from 'react';

export type TitlePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export type PhotoThumbnailCardProps = {
  /** 底圖 URL（staticFile 路徑） */
  backgroundImage: string;
  /** 主標題 */
  title: string;
  /** 副標題 */
  subtitle?: string;
  /** 標題位置 */
  titlePosition?: TitlePosition;
  /** 頻道名稱 */
  channelName?: string;
  /** 集數標籤 e.g. "EP01" */
  episodeTag?: string;
  /** 右上角品牌 logo */
  logoUrl?: string;
  /** 邊框漸變 CSS */
  borderGradient?: string;
  /** 邊框粗細 */
  borderWidth?: number;
  /** 寬度 */
  width?: number;
  /** 高度 */
  height?: number;
};

const DEFAULT_BORDER = 'linear-gradient(90deg, #e67e22 0%, #d35400 30%, #8e44ad 70%, #9b59b6 100%)';

/**
 * 根據 titlePosition 決定 flex 對齊 + 遮罩方向
 */
function getPositionStyles(pos: TitlePosition) {
  switch (pos) {
    case 'top-left':
      return {
        justify: 'flex-start' as const,
        align: 'flex-start' as const,
        textAlign: 'left' as const,
        gradient: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
        padding: '60px 60px 40% 60px',
      };
    case 'top-right':
      return {
        justify: 'flex-start' as const,
        align: 'flex-end' as const,
        textAlign: 'right' as const,
        gradient: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
        padding: '60px 60px 40% 60px',
      };
    case 'bottom-right':
      return {
        justify: 'flex-end' as const,
        align: 'flex-end' as const,
        textAlign: 'right' as const,
        gradient: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
        padding: '40% 60px 60px 60px',
      };
    case 'center':
      return {
        justify: 'center' as const,
        align: 'center' as const,
        textAlign: 'center' as const,
        gradient: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 70%, transparent 100%)',
        padding: '60px',
      };
    case 'bottom-left':
    default:
      return {
        justify: 'flex-end' as const,
        align: 'flex-start' as const,
        textAlign: 'left' as const,
        gradient: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
        padding: '40% 60px 60px 60px',
      };
  }
}

export const PhotoThumbnailCard: React.FC<PhotoThumbnailCardProps> = ({
  backgroundImage,
  title,
  subtitle,
  titlePosition = 'bottom-left',
  channelName,
  episodeTag,
  logoUrl,
  borderGradient = DEFAULT_BORDER,
  borderWidth = 12,
  width = 1280,
  height = 720,
}) => {
  const pos = getPositionStyles(titlePosition);

  // 動態字級（YT 縮圖需要超大字）
  const titleLen = title.replace(/[^\w\u4e00-\u9fff]/g, '').length;
  let titleFontSize: number;
  if (titleLen <= 6) titleFontSize = 150;
  else if (titleLen <= 10) titleFontSize = 130;
  else if (titleLen <= 16) titleFontSize = 105;
  else if (titleLen <= 22) titleFontSize = 88;
  else titleFontSize = 72;

  const headerText = [channelName, episodeTag].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Noto Sans TC', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── 1. 上方漸變邊框 ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: borderWidth,
          background: borderGradient,
        }}
      />

      {/* ── 1b. 下方漸變邊框 ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: borderWidth,
          background: borderGradient,
        }}
      />

      {/* ── 2. 底圖 ── */}
      <div
        style={{
          position: 'absolute',
          top: borderWidth,
          left: 0,
          right: 0,
          bottom: borderWidth,
          overflow: 'hidden',
        }}
      >
        <img
          src={backgroundImage}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* ── 3. 遮罩層（根據 titlePosition 方向漸變） ── */}
      <div
        style={{
          position: 'absolute',
          top: borderWidth,
          left: 0,
          right: 0,
          bottom: borderWidth,
          background: pos.gradient,
        }}
      />

      {/* ── 4. 文字層 ── */}
      <div
        style={{
          position: 'absolute',
          top: borderWidth,
          left: 0,
          right: 0,
          bottom: borderWidth,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: pos.justify,
          alignItems: pos.align,
          padding: pos.padding,
          zIndex: 5,
        }}
      >
        {/* Badge header */}
        {headerText && (
          <div
            style={{
              display: 'inline-block',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 6,
              textTransform: 'uppercase' as const,
              padding: '10px 28px',
              marginBottom: 16,
              borderRadius: 6,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            {headerText}
          </div>
        )}

        {/* 主標題 — 超大白字 + 粗描邊 */}
        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.1,
            textAlign: pos.textAlign,
            textShadow: `
              0 8px 24px rgba(0, 0, 0, 0.9),
              0 4px 0px rgba(0, 0, 0, 0.7),
              0 0 40px rgba(0, 0, 0, 0.5)
            `,
            WebkitTextStroke: '5px rgba(0, 0, 0, 0.7)',
            paintOrder: 'stroke fill' as any,
            maxWidth: '100%',
            wordBreak: 'keep-all' as any,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>

        {/* 副標題 */}
        {subtitle && (
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              marginTop: 16,
              textAlign: pos.textAlign,
              textShadow: `
                0 4px 12px rgba(0, 0, 0, 0.8),
                0 2px 0px rgba(0, 0, 0, 0.5)
              `,
              WebkitTextStroke: '2px rgba(0, 0, 0, 0.4)',
              paintOrder: 'stroke fill' as any,
              letterSpacing: 1,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* ── 5. Logo（右上角） ── */}
      {logoUrl && (
        <div
          style={{
            position: 'absolute',
            top: borderWidth + 20,
            right: borderWidth + 20,
            zIndex: 10,
          }}
        >
          <img
            src={logoUrl}
            style={{
              height: 80,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
            }}
          />
        </div>
      )}
    </div>
  );
};
