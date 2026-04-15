import React, { useMemo } from "react";
import { interpolate } from "remotion";
import { TypewriterText } from "../../ui/TypewriterText";
import {
  ArtifactBlock,
  BadgeRow,
  BranchTag,
  computeTimings,
} from "./shared";
import type { MockAppMessage } from "./types";

const DESKTOP_SCALE = 26 / 14;

const MobileChat: React.FC<{
  appName: string;
  messages: MockAppMessage[];
  charsPerSecond: number;
  inputPlaceholder: string;
  frame: number;
  fps: number;
}> = ({ appName, messages, charsPerSecond, inputPlaceholder, frame, fps }) => {
  const timings = useMemo(
    () => computeTimings(messages, charsPerSecond, fps),
    [messages, charsPerSecond, fps],
  );

  let typingMsgIndex = -1;
  let typingText = "";
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const t = timings[i];
    if (msg.role === "user" && frame >= t.startFrame && frame < t.sendFrame) {
      typingMsgIndex = i;
      const elapsed = Math.max(0, frame - t.startFrame);
      const chars = Math.min(
        msg.text.length,
        Math.floor((elapsed / fps) * charsPerSecond),
      );
      typingText = msg.text.slice(0, chars);
      break;
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "44px 20px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            width: 28,
          }}
        >
          <div style={{ width: 22, height: 2, backgroundColor: "#888" }} />
          <div style={{ width: 16, height: 2, backgroundColor: "#888" }} />
          <div style={{ width: 22, height: 2, backgroundColor: "#888" }} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>
          {appName} <span style={{ fontSize: 14, color: "#888" }}>▾</span>
        </span>
        <span style={{ fontSize: 24, color: "#888", letterSpacing: 2 }}>⋮</span>
      </div>

      <div
        style={{
          flex: 1,
          padding: "12px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          overflow: "hidden",
        }}
      >
        {messages.map((msg, i) => {
          const t = timings[i];
          const isUser = msg.role === "user";

          if (isUser) {
            if (frame < t.sendFrame) return null;
            const age = frame - t.sendFrame;
            const slideUp = interpolate(age, [0, 4], [16, 0], {
              extrapolateRight: "clamp",
            });
            const opacity = interpolate(age, [0, 3], [0, 1], {
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  opacity,
                  transform: `translateY(${slideUp}px)`,
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "14px 20px",
                    borderRadius: 20,
                    backgroundColor: "#333",
                    color: "#e2e8f0",
                    fontSize: 22,
                    lineHeight: 1.6,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          if (frame < t.startFrame) return null;
          const age = frame - t.startFrame;
          const opacity = interpolate(age, [0, 4], [0, 1], {
            extrapolateRight: "clamp",
          });
          const attachmentDelay = fps * 0.3;
          const attachOpacity =
            frame >= t.sendFrame
              ? interpolate(frame - t.sendFrame, [0, attachmentDelay], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                opacity,
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  lineHeight: 1.7,
                  color: "#e2e8f0",
                  maxWidth: "95%",
                }}
              >
                <TypewriterText
                  text={msg.text}
                  charsPerSecond={charsPerSecond}
                  startFrame={t.startFrame}
                  cursor={frame < t.sendFrame}
                />
              </div>

              {frame >= t.sendFrame && (
                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    marginTop: 4,
                    opacity: interpolate(frame - t.sendFrame, [0, 4], [0, 0.5], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  {["📋", "▶", "👍", "🔖"].map((icon, j) => (
                    <span
                      key={j}
                      style={{ fontSize: 18, filter: "grayscale(1)", opacity: 0.6 }}
                    >
                      {icon}
                    </span>
                  ))}
                </div>
              )}

              {msg.artifact && <ArtifactBlock artifact={msg.artifact} opacity={attachOpacity} />}
              {msg.badges && <BadgeRow badges={msg.badges} opacity={attachOpacity} />}
              {msg.branch && <BranchTag branch={msg.branch} opacity={attachOpacity} />}

              {msg.placeholder && frame >= t.sendFrame && (
                <div
                  style={{
                    marginTop: 4,
                    width: "85%",
                    height: msg.placeholder.height || 80,
                    borderRadius: 12,
                    backgroundColor: msg.placeholder.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    opacity: attachOpacity,
                  }}
                >
                  {msg.placeholder.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "6px 24px",
        }}
      >
        <span style={{ fontSize: 20, color: "#e07a50" }}>✳</span>
        <span style={{ fontSize: 13, color: "#666" }}>
          Claude can make mistakes. Please double check responses.
        </span>
      </div>

      <div style={{ padding: "8px 20px 22px" }}>
        <div
          style={{
            backgroundColor: "#333",
            borderRadius: 24,
            border: "1px solid #444",
            padding: "14px 18px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 52,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: typingMsgIndex >= 0 ? "#e2e8f0" : "#555",
              lineHeight: 1.5,
            }}
          >
            {typingMsgIndex >= 0 ? (
              <>
                {typingText}
                <span
                  style={{
                    display: "inline-block",
                    width: "0.6ch",
                    marginLeft: "0.05ch",
                    opacity: Math.floor(frame / (fps / 2)) % 2 === 0 ? 1 : 0,
                  }}
                >
                  |
                </span>
              </>
            ) : (
              inputPlaceholder
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#6ee7b7", fontSize: 15 }}>{`</>`}</span>
              <span style={{ color: "#888", fontSize: 15 }}>Code</span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 20, color: "#666" }}>+</span>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: typingMsgIndex >= 0 ? "#e07a50" : "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  color: typingMsgIndex >= 0 ? "#fff" : "#666",
                }}
              >
                ↑
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const DesktopChat: React.FC<{
  appName: string;
  messages: MockAppMessage[];
  charsPerSecond: number;
  inputPlaceholder: string;
  frame: number;
  fps: number;
}> = ({ appName, messages, charsPerSecond, inputPlaceholder, frame, fps }) => {
  const timings = useMemo(
    () => computeTimings(messages, charsPerSecond, fps),
    [messages, charsPerSecond, fps],
  );

  let typingMsgIndex = -1;
  let typingText = "";
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const t = timings[i];
    if (msg.role === "user" && frame >= t.startFrame && frame < t.sendFrame) {
      typingMsgIndex = i;
      const elapsed = Math.max(0, frame - t.startFrame);
      const chars = Math.min(
        msg.text.length,
        Math.floor((elapsed / fps) * charsPerSecond),
      );
      typingText = msg.text.slice(0, chars);
      break;
    }
  }

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: "#1e1e1e",
      }}
    >
      <div
        style={{
          width: 240,
          backgroundColor: "#191919",
          borderRight: "1px solid #333",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              color: "#ececec",
              fontWeight: 600,
              fontSize: 30,
              marginBottom: 16,
            }}
          >
            {appName}
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#888",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Today
          </div>
          <div
            style={{
              padding: "8px 10px",
              backgroundColor: "#2d2d2d",
              borderRadius: 6,
              color: "#ececec",
              fontSize: 28,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {messages[0]?.text || "New Chat"}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 60,
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
          }}
        >
          <span style={{ color: "#ececec", fontSize: 32, fontWeight: 500 }}>
            Advanced Model
          </span>
        </div>

        <div
          style={{
            flex: 1,
            padding: "30px 40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 30,
            overflow: "hidden",
          }}
        >
          {messages.map((msg, i) => {
            const t = timings[i];
            const isUser = msg.role === "user";

            if (isUser) {
              if (frame < t.sendFrame) return null;
              const age = frame - t.sendFrame;
              const slideUp = interpolate(age, [0, 4], [16, 0], {
                extrapolateRight: "clamp",
              });
              const opacity = interpolate(age, [0, 3], [0, 1], {
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    opacity,
                    transform: `translateY(${slideUp}px)`,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "12px 18px",
                      borderRadius: "16px",
                      backgroundColor: "#3a3a3a",
                      color: "#ececec",
                      fontSize: 32,
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            }

            if (frame < t.startFrame) return null;
            const age = frame - t.startFrame;
            const opacity = interpolate(age, [0, 4], [0, 1], {
              extrapolateRight: "clamp",
            });
            const attachmentDelay = fps * 0.3;
            const attachOpacity =
              frame >= t.sendFrame
                ? interpolate(
                    frame - t.sendFrame,
                    [0, attachmentDelay],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  )
                : 0;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  opacity,
                  gap: 8,
                  paddingLeft: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    lineHeight: 1.6,
                    color: "#ececec",
                    maxWidth: "85%",
                  }}
                >
                  <TypewriterText
                    text={msg.text}
                    charsPerSecond={charsPerSecond}
                    startFrame={t.startFrame}
                    cursor={frame < t.sendFrame}
                  />
                </div>

                {msg.artifact && (
                  <ArtifactBlock
                    artifact={msg.artifact}
                    opacity={attachOpacity}
                    scale={DESKTOP_SCALE}
                  />
                )}
                {msg.badges && (
                  <BadgeRow
                    badges={msg.badges}
                    opacity={attachOpacity}
                    scale={DESKTOP_SCALE}
                  />
                )}
                {msg.branch && (
                  <BranchTag
                    branch={msg.branch}
                    opacity={attachOpacity}
                    scale={DESKTOP_SCALE}
                  />
                )}

                {msg.placeholder && frame >= t.sendFrame && (
                  <div
                    style={{
                      marginTop: 8,
                      width: "100%",
                      maxWidth: 400,
                      height: msg.placeholder.height || 60,
                      borderRadius: 10,
                      backgroundColor: msg.placeholder.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                      opacity: attachOpacity,
                    }}
                  >
                    {msg.placeholder.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "0 40px 30px" }}>
          <div
            style={{
              backgroundColor: "#2d2d2d",
              borderRadius: 12,
              border: "1px solid #444",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 100,
            }}
          >
            <div
              style={{
                fontSize: 32,
                color: typingMsgIndex >= 0 ? "#ececec" : "#666",
                lineHeight: 1.5,
                flex: 1,
              }}
            >
              {typingMsgIndex >= 0 ? (
                <>
                  {typingText}
                  <span
                    style={{
                      display: "inline-block",
                      width: "0.6ch",
                      marginLeft: "0.05ch",
                      opacity: Math.floor(frame / (fps / 2)) % 2 === 0 ? 1 : 0,
                    }}
                  >
                    |
                  </span>
                </>
              ) : (
                inputPlaceholder
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#666", fontSize: 28 }}>+ Attachment</span>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: typingMsgIndex >= 0 ? "#d97757" : "#444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: typingMsgIndex >= 0 ? "#fff" : "#888",
                }}
              >
                ↑
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChatView: React.FC<{
  device: "desktop" | "mobile";
  appName: string;
  messages: MockAppMessage[];
  charsPerSecond: number;
  inputPlaceholder: string;
  frame: number;
  fps: number;
}> = (props) =>
  props.device === "mobile" ? <MobileChat {...props} /> : <DesktopChat {...props} />;
