import React, { useMemo } from "react";
import { TypewriterText } from "../../ui/TypewriterText";
import type { MockTerminalLine } from "./types";

export const TerminalView: React.FC<{
  lines: MockTerminalLine[];
  charsPerSecond: number;
  frame: number;
  fps: number;
}> = ({ lines, charsPerSecond, frame, fps }) => {
  const lineTimings = useMemo(() => {
    const timings: { startFrame: number; endFrame: number }[] = [];
    let cursor = 0;
    for (const line of lines) {
      const startFrame = cursor;
      if (line.type === "command") {
        const typeDuration = (line.text.length / charsPerSecond) * fps;
        const pause = (line.pauseAfter ?? 0.3) * fps;
        cursor += typeDuration + pause;
      } else {
        cursor += (line.pauseAfter ?? 0.3) * fps;
      }
      timings.push({ startFrame, endFrame: cursor });
    }
    return timings;
  }, [lines, charsPerSecond, fps]);

  return (
    <div
      style={{
        padding: 28,
        flex: 1,
        backgroundColor: "#0f1720",
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 26,
        lineHeight: 1.8,
        color: "#e2e8f0",
        overflow: "hidden",
      }}
    >
      {lines.map((line, i) => {
        const timing = lineTimings[i];
        if (frame < timing.startFrame) return null;

        if (line.type === "command") {
          return (
            <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <span style={{ color: "#2dd4bf", marginRight: 12 }}>$</span>
              <TypewriterText
                text={line.text}
                charsPerSecond={charsPerSecond}
                startFrame={timing.startFrame}
                cursor={i === lines.length - 1 || frame < timing.endFrame}
              />
            </div>
          );
        }

        return (
          <div
            key={i}
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: line.text.startsWith("✅")
                ? "#6b8f71"
                : line.text.startsWith("❌")
                  ? "#e03131"
                  : "#94a3b8",
            }}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
};
