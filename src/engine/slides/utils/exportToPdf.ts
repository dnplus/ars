/**
 * @file exportToPdf.ts
 * @description PDF 匯出工具 - 使用 html2canvas 截圖每張投影片
 *              截圖時會暫時重設 scale 為 1 以獲得完整 1920x1080 解析度
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * PDF 匯出所需的上下文
 */
export interface PdfExportContext {
  slideContainer: HTMLElement;
  goToSlide: (index: number) => void;
  currentIndex: number;
  totalSlides: number;
  filename: string;
}

/**
 * 執行 PDF 匯出 - 截圖每張投影片
 */
export async function exportToPdf(ctx: PdfExportContext): Promise<void> {
  const { slideContainer, goToSlide, currentIndex, totalSlides, filename } = ctx;
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1920, 1080],
  });
  
  const originalIndex = currentIndex;
  const originalTransform = slideContainer.style.transform;
  
  // 暫時重設 scale 為 1 以獲得完整解析度
  slideContainer.style.transform = 'scale(1)';
  
  for (let i = 0; i < totalSlides; i++) {
    goToSlide(i);
    await new Promise(r => setTimeout(r, 400));
    
    const canvas = await html2canvas(slideContainer, {
      scale: 1, // 容器已是 1920x1080，不需要額外縮放
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0a0a1a',
      logging: false,
      width: 1920,
      height: 1080,
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    
    if (i > 0) {
      pdf.addPage();
    }
    
    pdf.addImage(imgData, 'JPEG', 0, 0, 1920, 1080);
  }
  
  // 恢復原本的 transform
  slideContainer.style.transform = originalTransform;
  goToSlide(originalIndex);
  
  pdf.save(filename);
}
