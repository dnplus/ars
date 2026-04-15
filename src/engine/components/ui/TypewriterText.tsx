/**
 * @component TypewriterText
 * @description 逐字打字機動畫效果，用於 TerminalCard
 * @reference https://github.com/leochiu-a/slidev-workspace-intro-video
 */

import type { FC } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export type TypewriterTextProps = {
  text: string;
  /** 每秒顯示字數（預設 22） */
  charsPerSecond?: number;
  /** 是否顯示閃爍游標（預設 true） */
  cursor?: boolean;
  /** 動畫開始前的延遲幀數（預設 0） */
  startFrame?: number;
};

export const TypewriterText: FC<TypewriterTextProps> = ({
  text,
  charsPerSecond = 22,
  cursor = true,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.max(0, Math.floor((elapsed / fps) * charsPerSecond));
  const clipped = text.slice(0, charsToShow);
  const isDone = charsToShow >= text.length;
  const showCursor = cursor && (!isDone || Math.floor(frame / (fps / 2)) % 2 === 0);

  return (
    <span style={{ display: "inline" }}>
      {clipped}
      {cursor ? (
        <span
          style={{
            display: "inline-block",
            width: "0.6ch",
            marginLeft: "0.05ch",
            opacity: showCursor ? 1 : 0,
          }}
        >
          |
        </span>
      ) : null}
    </span>
  );
};
