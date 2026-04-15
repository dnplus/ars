/**
 * @file exportToPptx.ts
 * @description 將 Episode 匯出為可編輯的 PowerPoint (PPTX) 檔案
 *              - Mermaid 圖表會渲染成 PNG 圖片
 *              - QR Code 會渲染成 PNG 圖片
 */
import PptxGenJS from 'pptxgenjs';
import mermaid from 'mermaid';
import { Episode, Step, CTAButton, QRCodeCTA } from '../../shared/types';

// 初始化 Mermaid
// mermaid.initialize 移至 exportToPptx 函式內（需要 episode theme）

/**
 * 將 SVG 轉換為 Base64 PNG (帶超時)
 * 使用 data URL 而非 blob URL 避免 CORS 問題
 * 使用 2x 解析度確保清晰度
 */
async function svgToBase64Png(svgString: string, width = 800, height = 600, bgColor = '#1e1e1e'): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('SVG to PNG conversion timeout'));
    }, 5000);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      clearTimeout(timeout);
      reject(new Error('Canvas context not available'));
      return;
    }

    const img = new Image();
    
    // 使用 data URL 而非 blob URL 避免 tainted canvas
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    img.onload = () => {
      clearTimeout(timeout);
      
      // 6x 解析度確保清晰度
      const scale = 6;
      const w = img.naturalWidth || width;
      const h = img.naturalHeight || height;
      
      canvas.width = w * scale;
      canvas.height = h * scale;
      
      ctx.scale(scale, scale);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };

    img.src = dataUrl;
  });
}

/**
 * 渲染 Mermaid 圖表為 Base64 PNG (帶超時)
 */
async function renderMermaidToBase64(chart: string, bgColor = '#1e1e1e'): Promise<string | null> {
  try {

    const id = `mermaid-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Mermaid render with timeout
    const renderPromise = mermaid.render(id, chart);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Mermaid render timeout')), 10000);
    });
    
    const { svg } = await Promise.race([renderPromise, timeoutPromise]);

    
    const result = await svgToBase64Png(svg, 800, 600, bgColor);

    return result;
  } catch (err) {
    console.error('[PPTX Export] Mermaid render failed:', err);
    return null;
  }
}

/**
 * 生成 QR Code 為 Base64 PNG (使用 Canvas API)
 */
async function renderQRCodeToBase64(url: string, size = 200, bgColor = '#0A1A3F'): Promise<string | null> {
  try {
    // 動態導入 qrcode library
    const QRCode = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: {
        dark: '#FFFFFF',
        light: bgColor,
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('QR code generation failed:', err);
    return null;
  }
}

/**
 * 將 Markdown 轉為純文字 (基本處理)
 */
function markdownToPlainText(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '') // 移除標題符號
    .replace(/\*\*(.+?)\*\*/g, '$1') // 粗體
    .replace(/\*(.+?)\*/g, '$1') // 斜體
    .replace(/`(.+?)`/g, '$1') // 行內程式碼
    .replace(/```[\s\S]*?```/g, '[Code Block]') // 程式碼區塊
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 連結
    .replace(/^\s*[-*+]\s+/gm, '• ') // 項目符號
    .trim();
}

/**
 * 格式化 CTA 按鈕文字
 */
function formatCtaButtons(buttons: CTAButton[]): string {
  return buttons.map((b) => `🔗 ${b.label}`).join('  |  ');
}

/**
 * 依 contentType 處理單張投影片
 */
type PptxStyles = {
  pptxColors: { bgDark: string; primary: string; textInverse: string; textMuted: string; cardBg: string; codeBackground: string };
  TITLE_STYLE: PptxGenJS.TextPropsOptions;
  BODY_STYLE: PptxGenJS.TextPropsOptions;
  CODE_STYLE: PptxGenJS.TextPropsOptions;
  surfaceDark: string;
};

async function addSlideForStep(
  pptx: PptxGenJS,
  step: Step,
  slideIndex: number,
  episodeTitle: string,
  styles: PptxStyles
): Promise<void> {
  const { pptxColors, TITLE_STYLE, BODY_STYLE, CODE_STYLE, surfaceDark } = styles;
  const slide = pptx.addSlide();

  // 背景色
  slide.background = { color: pptxColors.bgDark };

  // 頁碼
  slide.addText(`${slideIndex + 1}`, {
    x: 9.2,
    y: 5.2,
    w: 0.5,
    h: 0.3,
    fontSize: 10,
    color: pptxColors.textMuted,
  });

  // Cover 投影片
  if (step.contentType === 'cover') {
    slide.addText(step.cardTitle || episodeTitle, {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1.5,
      ...TITLE_STYLE,
      fontSize: 44,
      align: 'center',
      valign: 'middle',
    });

    if (step.cardContent) {
      slide.addText(step.cardContent, {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 0.8,
        ...BODY_STYLE,
        fontSize: 24,
        align: 'center',
        color: pptxColors.textMuted,
      });
    }

    if (step.narration) {
      slide.addNotes(step.narration);
    }
    return;
  }

  // Summary 投影片
  if (step.contentType === 'summary') {
    slide.addText(step.summaryTitle || step.cardTitle || 'Summary', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.8,
      ...TITLE_STYLE,
      fontSize: 36,
      align: 'center',
    });

    // Summary points
    let contentEndY = 1.2;
    if (step.summaryPoints && step.summaryPoints.length > 0) {
      const pointsText = step.summaryPoints.map((p) => `• ${p}`).join('\n');
      slide.addText(pointsText, {
        x: 0.5,
        y: 1.2,
        w: 6,
        h: 2.5,
        ...BODY_STYLE,
        valign: 'top',
      });
      contentEndY = 3.8;
    } else if (step.cardContent) {
      slide.addText(step.cardContent, {
        x: 0.5,
        y: 1.2,
        w: 6,
        h: 2.5,
        ...BODY_STYLE,
        valign: 'top',
      });
      contentEndY = 3.8;
    }

    // QR Codes (渲染成圖片)
    if (step.summaryQrCodes && step.summaryQrCodes.length > 0) {
      const qrStartX = 7;
      for (let i = 0; i < Math.min(step.summaryQrCodes.length, 2); i++) {
        const qr = step.summaryQrCodes[i];
        const qrBase64 = await renderQRCodeToBase64(qr.url, 150, '#' + pptxColors.bgDark);
        if (qrBase64) {
          slide.addImage({
            data: qrBase64,
            x: qrStartX,
            y: 1.2 + i * 2,
            w: 1.5,
            h: 1.5,
          });
          if (qr.title) {
            slide.addText(qr.title, {
              x: qrStartX - 0.5,
              y: 2.7 + i * 2,
              w: 2.5,
              h: 0.3,
              fontSize: 10,
              color: pptxColors.textMuted,
              align: 'center',
            });
          }
        }
      }
    }

    // CTA 按鈕
    if (step.summaryCtaButtons && step.summaryCtaButtons.length > 0) {
      slide.addText(formatCtaButtons(step.summaryCtaButtons), {
        x: 0.5,
        y: 4.5,
        w: 9,
        h: 0.5,
        ...BODY_STYLE,
        align: 'center',
      });
    }

    if (step.narration) {
      slide.addNotes(step.narration);
    }
    return;
  }

  // Content 投影片 (text, markdown, code, image, mermaid, ticker)
  const contentY = step.cardTitle ? 1.2 : 0.5;
  const contentH = step.cardTitle ? 4 : 4.7;

  // 標題
  if (step.cardTitle) {
    slide.addText(step.cardTitle, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.8,
      ...TITLE_STYLE,
    });
  }

  // 依 contentType 處理內容
  switch (step.contentType) {
    case 'text':
      slide.addText(step.cardContent || '', {
        x: 0.5,
        y: contentY,
        w: 9,
        h: contentH,
        ...BODY_STYLE,
        valign: 'top',
      });
      break;

    case 'markdown':
      slide.addText(markdownToPlainText(step.cardContent || ''), {
        x: 0.5,
        y: contentY,
        w: 9,
        h: contentH,
        ...BODY_STYLE,
        valign: 'top',
      });
      break;

    case 'code':
      // 程式碼區塊
      slide.addShape('rect', {
        x: 0.3,
        y: contentY,
        w: 9.4,
        h: contentH,
        fill: { color: pptxColors.codeBackground },
        line: { color: pptxColors.textMuted, width: 1 },
      });
      slide.addText(step.code || '', {
        x: 0.5,
        y: contentY + 0.2,
        w: 9,
        h: contentH - 0.4,
        ...CODE_STYLE,
        valign: 'top',
      });
      break;

    case 'image':
      // 圖片說明 (因為無法直接嵌入本地圖片)
      slide.addText(`[Image: ${step.imageSrc || 'N/A'}]`, {
        x: 0.5,
        y: contentY,
        w: 9,
        h: 1,
        ...BODY_STYLE,
        color: pptxColors.textMuted,
        italic: true,
      });
      if (step.imageCaption) {
        slide.addText(step.imageCaption, {
          x: 0.5,
          y: contentY + 1.2,
          w: 9,
          h: contentH - 1.2,
          ...BODY_STYLE,
        });
      }
      break;

    case 'mermaid':
      // 嘗試渲染 Mermaid 為圖片
      if (step.mermaidChart) {
        const mermaidBase64 = await renderMermaidToBase64(step.mermaidChart, '#' + pptxColors.bgDark);
        if (mermaidBase64) {
          // 成功渲染為圖片
          slide.addImage({
            data: mermaidBase64,
            x: 0.5,
            y: contentY,
            w: 9,
            h: contentH,
            sizing: { type: 'contain', w: 9, h: contentH },
          });
        } else {
          // 渲染失敗，fallback 為程式碼
          slide.addText('[Mermaid Diagram - Render failed]', {
            x: 0.5,
            y: contentY,
            w: 9,
            h: 0.5,
            ...BODY_STYLE,
            color: pptxColors.textMuted,
            italic: true,
          });
          slide.addShape('rect', {
            x: 0.3,
            y: contentY + 0.6,
            w: 9.4,
            h: contentH - 0.6,
            fill: { color: pptxColors.codeBackground },
            line: { color: pptxColors.textMuted, width: 1 },
          });
          slide.addText(step.mermaidChart, {
            x: 0.5,
            y: contentY + 0.8,
            w: 9,
            h: contentH - 1,
            ...CODE_STYLE,
            fontSize: 11,
            valign: 'top',
          });
        }
      }
      break;

    case 'ticker':
      // Ticker 內容 (從 cardContent 解析多行)
      const tickerContent = step.cardContent || '';
      slide.addText(tickerContent, {
        x: 0.5,
        y: contentY,
        w: 9,
        h: contentH,
        ...BODY_STYLE,
        valign: 'top',
      });
      break;

    default:
      // 預設：顯示 cardContent
      if (step.cardContent) {
        slide.addText(step.cardContent, {
          x: 0.5,
          y: contentY,
          w: 9,
          h: contentH,
          ...BODY_STYLE,
          valign: 'top',
        });
      }
  }

  // 講者備註
  if (step.narration) {
    slide.addNotes(step.narration);
  }
}

/**
 * 匯出 Episode 為 PPTX
 */
export async function exportToPptx(episode: Episode): Promise<void> {
  const theme = episode.shell!.theme!;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: theme.colors.primary,
      primaryTextColor: theme.colors.onPrimary,
      primaryBorderColor: theme.colors.border,
      lineColor: theme.colors.onCardMuted,
      secondaryColor: theme.colors.surfaceCard,
      tertiaryColor: theme.colors.surfaceDark,
    },
  });

  const pptxColors = {
    bgDark: theme.colors.surfaceDark.replace('#', ''),
    primary: theme.colors.primary.replace('#', ''),
    textInverse: theme.colors.onPrimary.replace('#', ''),
    textMuted: theme.colors.onCardMuted.replace('#', ''),
    cardBg: theme.colors.surfaceCard.replace('#', ''),
    codeBackground: theme.colors.surfaceCode.replace('#', ''),
  };

  const TITLE_STYLE: PptxGenJS.TextPropsOptions = {
    fontFace: 'Arial',
    fontSize: 32,
    bold: true,
    color: pptxColors.textInverse,
  };

  const BODY_STYLE: PptxGenJS.TextPropsOptions = {
    fontFace: 'Arial',
    fontSize: 18,
    color: pptxColors.textInverse,
  };

  const CODE_STYLE: PptxGenJS.TextPropsOptions = {
    fontFace: 'Consolas',
    fontSize: 14,
    color: pptxColors.textInverse,
  };

  const pptx = new PptxGenJS();

  // 設定簡報屬性
  pptx.title = episode.metadata.title;
  pptx.subject = episode.metadata.subtitle || '';
  pptx.author = episode.metadata.channelName || 'Agentic Remotion Studio';
  pptx.layout = 'LAYOUT_16x9';

  // 產生投影片 (需要按順序處理因為有 async)
  for (let i = 0; i < episode.steps.length; i++) {
    await addSlideForStep(pptx, episode.steps[i], i, episode.metadata.title, {
      pptxColors, TITLE_STYLE, BODY_STYLE, CODE_STYLE, surfaceDark: theme.colors.surfaceDark,
    });
  }

  // 下載
  const filename = `${episode.metadata.id}_${episode.metadata.episodeTag || 'slides'}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
