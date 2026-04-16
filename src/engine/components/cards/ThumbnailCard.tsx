/**
 * @component ThumbnailCard
 * @description YouTube Thumbnail — 專門用來輸出 YT 縮圖的獨立元件。
 * 
 * 設計原則：
 * - 字要大、填滿螢幕
 * - 高亮外框讓縮圖從列表中跳出來
 * - 配色鮮明、對比強烈
 * - 不含 VTuber、字幕等影片中的元素
 */
import React from 'react';
import { Img } from 'remotion';

export type ThumbnailCardProps = {
  /** 主標題（會盡可能放大填滿） */
  title: string;
  /** 副標題（可選，顯示在主標題下方） */
  subtitle?: string;
  /** 頻道名稱 */
  channelName?: string;
  /** 集數標籤 e.g. "EP01" */
  episodeTag?: string;
  /** 主題色系 */
  theme?: {
    primary: string;
    accent: string;
    surfaceDark: string;
    onDark: string;
  };
  /** 吉祥物或角色圖 (VTuber) */
  mascotUrl?: string;
  /** 寬度（預設 1280） */
  width?: number;
  /** 高度（預設 720） */
  height?: number;
};

const DEFAULT_THEME = {
  primary: '#e6c373',
  accent: '#a67c29',
  surfaceDark: '#120e0a',
  onDark: '#ffffff',
};

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

  // 直式：在 #數字 後換行；橫式：去標點連在一起
  const titleLines: string[] = (() => {
    const stripped = title.replace(/[！？。，、；：「」『』（）【】《》〈〉…—～\-!?,.:;'"()[\]{}<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (isPortrait) {
      const match = title.match(/^(.+?#\d+)\s*[-—]?\s*(.+)$/);
      if (match) {
        return [match[1].trim(), match[2].replace(/[！？。，、；：「」『』（）【】《》〈〉…—～\-!?,.:;'"()[\]{}<>]/g, ' ').replace(/\s+/g, ' ').trim()].filter(Boolean);
      }
    }
    return [stripped];
  })();

  // 根據文字量 + 方向動態計算 fontSize
  const longestLine = Math.max(...titleLines.map(l => l.length));
  const titleLen = isPortrait ? longestLine : titleLines.join('').length;
  let titleFontSize: number;
  if (isPortrait) {
    // 直式比較窄，字要稍微小一點
    if (titleLen <= 6) titleFontSize = 180;
    else if (titleLen <= 10) titleFontSize = 150;
    else if (titleLen <= 16) titleFontSize = 130;
    else if (titleLen <= 22) titleFontSize = 110;
    else titleFontSize = 95;
  } else {
    if (titleLen <= 8) titleFontSize = 270;
    else if (titleLen <= 12) titleFontSize = 220;
    else if (titleLen <= 18) titleFontSize = 180;
    else if (titleLen <= 24) titleFontSize = 155;
    else titleFontSize = 130;
  }

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
      {/* ── 金屬邊框底層 ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `linear-gradient(135deg, ${t.accent}, ${t.primary}, #fff, ${t.primary}, ${t.accent})`,
        }}
      />
      {/* ── 內容區域（圓角裁切） ── */}
      <div
        style={{
          position: 'absolute',
          inset: 45,
          borderRadius: 24,
          overflow: 'hidden',
          background: t.surfaceDark,
          zIndex: 1,
          boxShadow: `
            inset 0 0 60px ${t.accent}33,
            inset 0 0 120px ${t.primary}15
          `,
        }}
      >

      {/* ── 背景漸層 (強烈對比) ── */}
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
          zIndex: 0,
        }}
      />

      {/* ── 裝飾：斜線紋理 ── */}
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
          zIndex: 1,
        }}
      />
      </div> {/* End of 內容圓角區 (bg + texture only) */}

      {/* ── 主內容區（不裁切，文字可超出邊框） ── */}
      <div
        style={{
          position: 'absolute',
          inset: isPortrait ? 0 : 45,
          zIndex: 5,
          display: 'flex',
          flexDirection: isPortrait ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isPortrait
            ? 'center'
            : mascotUrl ? 'flex-start' : 'center',
          padding: isPortrait
            ? mascotUrl
              ? `80px 10px ${Math.max(64, 72 - titleLines.length * 2)}% 10px`
              : '50px 10px'
            : mascotUrl ? '50px 50px 50px 60px' : '50px 80px',
          textAlign: isPortrait ? 'center' : mascotUrl ? 'left' : 'center',
        }}
      >
        {/* 文字區塊 */}
        <div
          style={{
            flex: isPortrait ? 'none' : mascotUrl ? '0 0 85%' : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isPortrait ? 'center' : mascotUrl ? 'flex-start' : 'center',
            zIndex: 20,
          }}
        >
        {/* 頻道名稱 / EP 標籤 — 消光髮絲紋金屬牌 */}
        {headerText && (
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              fontSize: isPortrait ? 44 : 36,
              fontWeight: 900,
              letterSpacing: isPortrait ? 14 : 8,
              marginBottom: isPortrait ? 20 : 16,
              textTransform: 'uppercase',
              padding: isPortrait ? '16px 48px' : '14px 40px',
              borderRadius: 6,
              // 消光金屬底色
              background: `linear-gradient(180deg, #c9a84c 0%, #b8943a 40%, #a68530 60%, #b8943a 100%)`,
              border: `2px solid #d4b05a`,
              // 3D 厚度
              borderBottom: `3px solid #7a6020`,
              borderRight: `2px solid #8a7030`,
              boxShadow: `
                inset 0 1px 2px rgba(255,255,255,0.35),
                inset 0 -1px 2px rgba(0,0,0,0.15),
                0 4px 0px #6a5518,
                0 6px 8px rgba(0,0,0,0.4),
                0 10px 24px rgba(0,0,0,0.3)
              `,
              // 凹刻文字
              color: '#4a3510',
              textShadow: `
                0 1px 0 rgba(255, 230, 160, 0.6),
                0 -1px 1px rgba(0, 0, 0, 0.35)
              `,
            }}
          >
            {/* 髮絲紋紋理 overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 6,
                opacity: 0.3,
                backgroundImage: `
                  repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 1px,
                    rgba(255,255,255,0.08) 1px,
                    rgba(255,255,255,0.08) 2px
                  )
                `,
                pointerEvents: 'none',
              }}
            />
            {/* 對角光澤 (subtle) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 6,
                background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.08) 100%)`,
                pointerEvents: 'none',
              }}
            />
            {headerText}
          </div>
        )}

        {/* 主標題 — 超大、白字、深色粗描邊 (YT 標準縮圖風格) */}
        <div
          style={{
            fontSize: titleFontSize,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.15,
            margin: '24px 0',
            textShadow: `
              0 15px 30px rgba(0, 0, 0, 0.8),
              0 0 30px ${t.primary}55,
              0 6px 0px #2a1f10
            `,
            WebkitTextStroke: `6px #2a1f10`,
            paintOrder: 'stroke fill',
            maxWidth: '100%',
            wordBreak: isPortrait ? 'break-word' as React.CSSProperties['wordBreak'] : 'keep-all',
            letterSpacing: titleFontSize > 100 ? -2 : -1,
          }}
        >
          {titleLines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </div>

        {/* 橫式副標題 — 在文字區塊內，正常排列 */}
        {!isPortrait && subtitle && (
          <div
            style={{
              fontSize: 38,
              fontWeight: 600,
              color: t.primary,
              marginTop: 20,
              textShadow: `
                0 0 15px ${t.primary}55,
                0 4px 8px rgba(0, 0, 0, 0.8)
              `,
              WebkitTextStroke: `2px #120e0a`,
              paintOrder: 'stroke fill',
              maxWidth: '90%',
              letterSpacing: 2,
            }}
          >
            {subtitle}
          </div>
        )}

        </div> {/* End of 文字區塊 */}
      </div> {/* End of 主內容區 */}

      {/* ── 吉祥物 (VTuber) — 蓋在邊框上 ── */}
      {mascotUrl && (
        <div
          style={{
            position: 'absolute',
            ...(isPortrait
              ? { bottom: '10%', left: '50%', transform: 'translateX(-50%)', width: '85%', height: '70%' }
              : { right: -30, bottom: -10, width: '45%', height: '115%' }
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

      {/* 直式副標題 — 在吉祥物上層 */}
      {isPortrait && subtitle && (
        <div
          style={{
            position: 'absolute',
            bottom: '5%',
            left: 0,
            right: 0,
            zIndex: 30,
            fontSize: 38,
            fontWeight: 600,
            color: t.primary,
            opacity: 0.9,
            textShadow: `
              0 0 15px ${t.primary}55,
              0 4px 8px rgba(0, 0, 0, 0.8)
            `,
            WebkitTextStroke: `2px #120e0a`,
            paintOrder: 'stroke fill',
            letterSpacing: 2,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </div>
      )}

    </div>
  );
};
