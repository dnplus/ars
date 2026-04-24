/**
 * @component SubtitleOverlay
 * @description 字幕覆蓋層 - 內部元件，僅供 StreamingLayout 使用
 *
 * 支援兩種模式：
 * 1. Whisper 時間戳（精準）：傳入 subtitles prop
 * 2. 均勻分段（fallback）：只傳入 text prop
 *
 * 原始來源：src/shared/overlays/SubtitleOverlay.tsx
 */

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { segmentTextEvenly, type SubtitlePhrase } from "../../shared/subtitle";

// 將粗粒度字幕按句號拆分，太短的段合併回前一段
// 只在句末標點（。！？）處切，不在逗號/分號/冒號切，避免太碎
const MIN_CHARS = 10;

// 清理標點：移除引號 + 清除全形標點旁多餘空格
const cleanPunct = (s: string) =>
  s.replace(/[「」『』]/g, '')
   .replace(/\s*([，。！？：；、）】》])\s*/g, '$1')
   .replace(/\s*([（【《])\s*/g, '$1')
   .replace(/\s{2,}/g, ' ')
   .trim();

// 修復 MiniMax 在引號中間切段的問題：
// 如果某段開頭是 」）等右括號，合併回前一段
const fixBrokenQuotes = (phrases: SubtitlePhrase[]): SubtitlePhrase[] => {
  const result: SubtitlePhrase[] = [];
  for (const p of phrases) {
    const c = { ...p, text: cleanPunct(p.text) };
    if (result.length > 0 && /^[」）】》'")\]]/.test(c.text)) {
      const prev = result[result.length - 1];
      // 把右引號（和緊跟的標點）搶回前一段
      const match = c.text.match(/^([」）】》'")\]][。！？，、：；.!?,;:]*)/);
      const stolen = match ? match[1] : c.text[0];
      const remaining = c.text.slice(stolen.length).trimStart();
      prev.text += stolen;
      prev.endTime = remaining ? c.startTime : c.endTime;
      if (remaining) {
        result.push({ text: remaining, startTime: c.startTime, endTime: c.endTime });
      }
    } else {
      result.push(c);
    }
  }
  return result;
};

const splitByPunctuation = (phrases: SubtitlePhrase[]): SubtitlePhrase[] => {
  const fixed = fixBrokenQuotes(phrases);
  const result: SubtitlePhrase[] = [];
  for (const p of fixed) {
    const duration = p.endTime - p.startTime;
    const sentences = p.text
      .split(/([。！？]|[.!?](?=\s|$))/)
      .filter(s => s.trim())
      .reduce((acc, curr) => {
        if (/^[。！？.!?]$/.test(curr)) {
          if (acc.length > 0) acc[acc.length - 1] += curr;
        } else {
          acc.push(curr);
        }
        return acc;
      }, [] as string[]);

    if (sentences.length <= 1) {
      result.push(p);
      continue;
    }

    // 合併太短的段到前一段
    const merged: string[] = [];
    for (const s of sentences) {
      if (merged.length > 0 && s.length < MIN_CHARS) {
        merged[merged.length - 1] += s;
      } else {
        merged.push(s);
      }
    }

    const totalChars = merged.reduce((sum, s) => sum + s.length, 0);
    let t = p.startTime;
    for (const s of merged) {
      const d = duration * (s.length / totalChars);
      result.push({ text: s.trim(), startTime: t, endTime: t + d });
      t += d;
    }
  }
  return result;
};

export type SubtitleOverlayProps = {
  /** 原始文字（用於 fallback 均勻分段） */
  text: string;
  /** Whisper 時間戳陣列（優先使用） */
  subtitles?: SubtitlePhrase[];
  containerStyle?: React.CSSProperties;
  style?: React.CSSProperties;
};

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  text,
  subtitles,
  containerStyle,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const totalDuration = durationInFrames / fps;
  const currentTime = frame / fps;

  // 優先使用傳入的 subtitles（拆分後），否則 fallback 到均勻分段
  const phrases = useMemo(() => {
    if (subtitles && subtitles.length > 0) {
      return splitByPunctuation(subtitles);
    }
    return segmentTextEvenly(text, totalDuration);
  }, [subtitles, text, totalDuration]);

  const currentIdx = phrases.findIndex(
    (p) => currentTime >= p.startTime && currentTime < p.endTime
  );

  if (currentIdx === -1) return null;

  const currentPhrase = phrases[currentIdx];
  // cleanPunct 已移除引號和多餘空格，這裡只需去掉句尾標點
  const displayText = currentPhrase.text
    .replace(/[。！？.!?]+$/, '')
    .trim();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 100,
        ...containerStyle,
      }}
    >
      {/* key 確保同一段字幕不會跨幀重新 layout，避免 headless render 抖動 */}
      <div
        key={currentIdx}
        data-annotatable="subtitle"
        data-annotatable-label="字幕"
        style={{
          padding: "10px 20px",
          borderRadius: 10,
          color: "white",
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.32,
          boxSizing: "border-box",
          wordBreak: "keep-all",
          // Studio review mode needs clicks on subtitles; render output ignores
          // pointer events anyway.
          pointerEvents: "auto",
          ...style,
          // 固定寬度避免容器隨文字長度變化
          width: style?.maxWidth ?? style?.width ?? "90%",
          maxWidth: undefined,
        }}
      >
        {displayText}
      </div>
    </AbsoluteFill>
  );
};
