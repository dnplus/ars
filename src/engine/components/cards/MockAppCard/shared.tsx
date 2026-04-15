import React from "react";
import type {
  MockAppArtifact,
  MockAppBadge,
  MockAppDevice,
  MockAppMessage,
} from "./types";

export type MsgTiming = {
  startFrame: number;
  sendFrame: number;
  endFrame: number;
};

export function computeTimings(
  messages: MockAppMessage[],
  cps: number,
  fps: number,
): MsgTiming[] {
  const timings: MsgTiming[] = [];
  let cursor = 0;

  for (const msg of messages) {
    const start = cursor;
    if (msg.role === "user") {
      const typeDuration = (msg.text.length / cps) * fps;
      const sendPause = 0.3 * fps;
      const sendFrame = start + typeDuration + sendPause;
      cursor = sendFrame + (msg.pauseAfter ?? 0.4) * fps;
      timings.push({ startFrame: start, sendFrame, endFrame: cursor });
    } else {
      const typeDuration = (msg.text.length / cps) * fps;
      const sendFrame = start + typeDuration;
      cursor = sendFrame + (msg.pauseAfter ?? 0.5) * fps;
      timings.push({ startFrame: start, sendFrame, endFrame: cursor });
    }
  }

  return timings;
}

export const ArtifactBlock: React.FC<{
  artifact: MockAppArtifact;
  opacity: number;
  scale?: number;
}> = ({ artifact, opacity, scale = 1 }) => (
  <div
    style={{
      marginTop: 8,
      backgroundColor: "#1e1e1e",
      border: "1px solid #3a3a3a",
      borderRadius: scale > 1 ? 8 : 12,
      overflow: "hidden",
      opacity,
      width: scale > 1 ? "100%" : undefined,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: scale > 1 ? "8px 12px" : "10px 16px",
        backgroundColor: "#252525",
        borderBottom: "1px solid #3a3a3a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#6ee7b7", fontSize: 14 * scale }}>{`</>`}</span>
        <span
          style={{
            color: "#e2e8f0",
            fontSize: 15 * scale,
            fontWeight: 500,
          }}
        >
          {artifact.label}
        </span>
      </div>
      {artifact.lines && (
        <span
          style={{
            color: "#6ee7b7",
            fontSize: 13 * scale,
            fontWeight: 600,
          }}
        >
          {artifact.lines}
        </span>
      )}
    </div>
    {artifact.preview && (
      <div
        style={{
          padding: scale > 1 ? "10px 12px" : "12px 16px",
          fontSize: 14 * scale,
          lineHeight: 1.6,
          color: "#94a3b8",
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          whiteSpace: "pre-wrap",
          maxHeight: scale > 1 ? 150 : 120,
          overflow: "hidden",
        }}
      >
        {artifact.preview}
      </div>
    )}
  </div>
);

export const BadgeRow: React.FC<{
  badges: MockAppBadge[];
  opacity: number;
  scale?: number;
}> = ({ badges, opacity, scale = 1 }) => (
  <div style={{ display: "flex", gap: scale > 1 ? 8 : 12, marginTop: 8, opacity }}>
    {badges.map((badge, index) => (
      <div
        key={index}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: scale > 1 ? "6px 12px" : "8px 16px",
          borderRadius: scale > 1 ? 8 : 10,
          backgroundColor: "#262626",
          border: `1px solid ${badge.color}44`,
        }}
      >
        <span
          style={{ color: "#e2e8f0", fontSize: 15 * scale, fontWeight: 600 }}
        >
          {badge.label}
        </span>
        {badge.value && (
          <span
            style={{ color: badge.color, fontSize: 14 * scale, fontWeight: 700 }}
          >
            {badge.value}
          </span>
        )}
      </div>
    ))}
  </div>
);

export const BranchTag: React.FC<{
  branch: string;
  opacity: number;
  scale?: number;
}> = ({ branch, opacity, scale = 1 }) => (
  <div
    style={{
      marginTop: 8,
      padding: scale > 1 ? "6px 12px" : "8px 14px",
      borderRadius: 8,
      backgroundColor: "#2a2a2a",
      fontSize: 14 * scale,
      color: "#94a3b8",
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      opacity,
      display: "inline-block",
    }}
  >
    {branch}
  </div>
);

export function getResolvedType(
  type?: string,
): "chat" | "terminal" | "browser" | "dashboard" {
  if (!type || type === "claude") return "chat";
  return type as "chat" | "terminal" | "browser" | "dashboard";
}

export function defaultAppName(
  device: MockAppDevice,
  type: "chat" | "terminal" | "browser" | "dashboard",
) {
  if (type === "terminal") return device === "mobile" ? "Shell" : "Terminal";
  if (type === "browser") return "Browser";
  if (type === "dashboard") return "Analytics";
  return device === "mobile" ? "AI Assistant" : "AI Assistant Desktop";
}
