/**
 * @module utils/subtitle
 * @description 字幕分段邏輯
 *
 * 原始來源：shared/components/AutoSubtitle.tsx
 */

export type SubtitlePhrase = {
  text: string;
  startTime: number;
  endTime: number;
};

/**
 * 等分分段字幕（當前實作）
 * 按標點符號分句，均勻分配時間
 * 
 * 英文句號後必須接空格才斷句，自動排除文件名（如 AGENTS.md）
 */
export function segmentTextEvenly(
  text: string,
  totalDuration: number
): SubtitlePhrase[] {
  // 按標點符號 + 空格/換行分句
  // 中文標點：。！？\n
  // 英文標點：. ! ? 後面必須接空格或換行
  const sentences = text
    .split(/([。！？\n]|[.!?](?=\s|\n))/)
    .filter((s) => s.trim())
    .reduce((acc, curr) => {
      if (/^[。！？\n.!?]$/.test(curr)) {
        if (acc.length > 0) {
          acc[acc.length - 1] += curr;
        }
      } else {
        acc.push(curr);
      }
      return acc;
    }, [] as string[]);

  if (sentences.length === 0) return [];

  const timePerSentence = totalDuration / sentences.length;

  return sentences.map((sentence, index) => ({
    text: sentence.trim(),
    startTime: index * timePerSentence,
    endTime: (index + 1) * timePerSentence,
  }));
}
