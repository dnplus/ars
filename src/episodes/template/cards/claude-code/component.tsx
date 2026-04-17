import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BaseSlide } from "../../../../engine/primitives/BaseSlide";
import { useTheme } from "../../../../engine/shared/ThemeContext";
import type { CardRenderProps } from "../../../../engine/cards/types";
import type {
  ClaudeCodeData,
  ClaudeCodeDetail,
  ClaudeCodeLine,
  ClaudeCodeTone,
} from "./schema";

const LOGO_LINES = [" ▐▛███▜▌", "▝▜█████▛▘", "  ▘▘ ▝▝"];
const UI = {
  canvas: "#2b2d35",
  panel: "#2b2d35",
  panelAlt: "#262830",
  line: "rgba(255,255,255,0.14)",
  lineSoft: "rgba(255,255,255,0.08)",
  text: "#e7e5e2",
  textMuted: "rgba(231,229,226,0.56)",
  textSoft: "rgba(231,229,226,0.38)",
  logo: "#d99796",
  prompt: "#e2d28c",
  positive: "#88a27e",
  negative: "#c78576",
  warning: "#d0b879",
  info: "#8ca6b6",
} as const;
const TONE_COLOR_TOKEN_MAP = {
  default: "onDark",
  muted: "onCardMuted",
  positive: "positive",
  negative: "negative",
  warning: "warning",
  highlight: "highlight",
  info: "info",
} as const;

const LINE_STYLE_MAP = {
  prompt: { marker: "❯", tone: "warning" },
  command: { marker: "$", tone: "default" },
  output: { marker: "", tone: "muted" },
  success: { marker: "⏺", tone: "positive" },
  error: { marker: "⏺", tone: "negative" },
  info: { marker: "⏺", tone: "highlight" },
  assistant: { marker: "⏺", tone: "default" },
  result: { marker: "⎿", tone: "muted" },
  tool: { marker: "⏺", tone: "default" },
  approval: { marker: "", tone: "default" },
  section: { marker: "", tone: "warning" },
} as const satisfies Record<
  ClaudeCodeLine["type"],
  { marker: string; tone: ClaudeCodeTone }
>;

const resolveToneColor = (
  tone: ClaudeCodeTone | undefined,
  theme: ReturnType<typeof useTheme>,
) => {
  void theme;
  if (tone === "default") return UI.text;
  if (tone === "muted") return UI.textMuted;
  if (tone === "positive") return UI.positive;
  if (tone === "negative") return UI.negative;
  if (tone === "warning") return UI.warning;
  if (tone === "highlight") return UI.warning;
  if (tone === "info") return UI.info;
  const colorToken = TONE_COLOR_TOKEN_MAP[tone ?? "default"];
  return theme.colors[colorToken] ?? UI.text;
};

const revealText = (text: string, progress: number) => {
  if (progress >= 0.999) {
    return text;
  }

  const characters = Array.from(text);
  const visibleCount = Math.max(
    0,
    Math.floor(interpolate(progress, [0, 1], [0, characters.length])),
  );

  return characters.slice(0, visibleCount).join("");
};

const compactText = (text: string, limit: number) => {
  const trimmed = text.trim();

  if (trimmed.length <= limit) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, limit - 1))}…`;
};

const slugFromSession = (session: ClaudeCodeData["session"], fallback: string) => {
  const workspaceLeaf = session?.workspace?.split("/").filter(Boolean).pop();
  const appLeaf = session?.appTitle
    ?.split(/[ /]/)
    .filter(Boolean)
    .pop();
  const source = workspaceLeaf ?? appLeaf ?? fallback;
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
};

const normalizeVersion = (version: string | undefined) => {
  const match = version?.match(/v?(\d+(?:\.\d+)+)/i);
  return match?.[1] ?? "2.1.112";
};

const describeStatus = (line: ClaudeCodeLine | undefined, tag: string | undefined) => {
  if (!line) {
    return tag?.toLowerCase() ?? "idle";
  }

  if (line.type === "prompt") {
    return `typing ${tag?.toLowerCase() ?? "input"}`;
  }

  if (line.type === "command") {
    return `running ${compactText(line.text, 18)}`;
  }

  if (line.type === "tool") {
    return line.meta
      ? `tool · ${compactText(line.meta.toLowerCase(), 18)}`
      : `tool · ${compactText(line.text.toLowerCase(), 18)}`;
  }

  if (line.type === "result") {
    return "tool result";
  }

  if (line.type === "assistant") {
    return "assistant reply";
  }

  if (line.type === "success") {
    return "ready for next step";
  }

  if (line.type === "error") {
    return "needs attention";
  }

  if (line.type === "approval") {
    return "awaiting approval";
  }

  if (line.type === "section") {
    return line.text.toLowerCase();
  }

  return compactText(line.text.toLowerCase(), 18);
};

const normalizeWorkflowStage = (value: string) =>
  value
    .toLowerCase()
    .replace(/\/ars:/g, "")
    .replace(/-youtube/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const extractWorkflowStagesFromLine = (
  line: ClaudeCodeLine,
  normalizedStages: string[],
) => {
  const matches = new Set<string>();
  const candidates = [line.text, line.meta].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeWorkflowStage(candidate);
    if (normalizedStages.includes(normalizedCandidate)) {
      matches.add(normalizedCandidate);
    }

    for (const stage of normalizedStages) {
      if (normalizedCandidate.includes(stage)) {
        matches.add(stage);
      }
    }

    const promptMatch = candidate.match(/\/ars:([a-z-]+)/gi) ?? [];
    for (const match of promptMatch) {
      const normalizedPromptStage = normalizeWorkflowStage(match);
      if (normalizedStages.includes(normalizedPromptStage)) {
        matches.add(normalizedPromptStage);
      }
    }
  }

  return [...matches];
};

const deriveActiveWorkflowStage = (
  workflow: string | undefined,
  tag: string | undefined,
  lines: ClaudeCodeLine[],
) => {
  const stages = workflow?.split("›").map((stage) => stage.trim()).filter(Boolean) ?? [];
  const normalizedStages = stages.map(normalizeWorkflowStage);
  const normalizedTag = normalizeWorkflowStage(tag ?? "");

  let furthestStageIndex = normalizedTag
    ? normalizedStages.indexOf(normalizedTag)
    : -1;

  for (const line of lines) {
    for (const stage of extractWorkflowStagesFromLine(line, normalizedStages)) {
      const stageIndex = normalizedStages.indexOf(stage);
      if (stageIndex >= 0) {
        furthestStageIndex = Math.max(furthestStageIndex, stageIndex);
      }
    }
  }

  if (furthestStageIndex >= 0) {
    return normalizedStages[furthestStageIndex];
  }

  return normalizedStages[0] ?? normalizedTag;
};

type LineEvent = {
  line: ClaudeCodeLine;
  start: number;
  historyStart: number;
  end: number;
  historyOnly: boolean;
  inputEnd?: number;
};

const isInputLine = (line: ClaudeCodeLine) =>
  line.type === "prompt" || line.type === "command";

const estimateTypingFrames = (line: ClaudeCodeLine) => {
  const textFrames = Math.ceil(Array.from(line.text).length * 0.45);
  const detailFrames = (line.details?.length ?? 0) * 6;

  if (line.type === "section") {
    return 10;
  }

  if (line.type === "tool" || line.type === "approval") {
    return Math.min(42, 14 + detailFrames);
  }

  if (isInputLine(line)) {
    return Math.max(16, Math.min(54, textFrames));
  }

  return Math.max(10, Math.min(36, Math.ceil(textFrames * 0.65) + detailFrames));
};

const buildTimeline = (lines: ClaudeCodeLine[]): LineEvent[] => {
  let cursor = 0;

  return lines.map((line) => {
    const revealFrames = estimateTypingFrames(line);

    if (isInputLine(line)) {
      const inputEnd = cursor + revealFrames;
      const historyStart = inputEnd + 4;
      const end = historyStart + 8;
      const event = {
        line,
        start: cursor,
        historyStart,
        end,
        historyOnly: false,
        inputEnd,
      } satisfies LineEvent;

      cursor = end + 4;
      return event;
    }

    const historyStart = cursor;
    const end = historyStart + revealFrames + 6;
    const event = {
      line,
      start: cursor,
      historyStart,
      end,
      historyOnly: true,
    } satisfies LineEvent;

    cursor = end;
    return event;
  });
};

const DetailLine: React.FC<{ detail: ClaudeCodeDetail }> = ({ detail }) => {
  const theme = useTheme();

  return (
    <div
      style={{
        color: resolveToneColor(detail.tone ?? "muted", theme),
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: 16,
        lineHeight: 1.52,
      }}
    >
      {detail.text}
    </div>
  );
};

const ClaudeCodeEntry: React.FC<{
  line: ClaudeCodeLine;
  progress: number;
}> = ({ line, progress }) => {
  const theme = useTheme();
  const baseOpacity = interpolate(progress, [0, 0.4, 1], [0, 0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(progress, [0, 1], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (line.type === "section") {
    return (
      <div
        style={{
          opacity: baseOpacity,
          transform: `translateY(${translateY}px)`,
          display: "inline-flex",
          alignSelf: "flex-start",
          padding: 0,
          color: UI.textSoft,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {line.text}
      </div>
    );
  }

  if (line.type === "tool") {
    return (
      <div
        style={{
          opacity: baseOpacity,
          transform: `translateY(${translateY}px)`,
          padding: "0 0 0 14px",
          borderLeft: `1px solid ${UI.lineSoft}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: line.details?.length ? 12 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                color: resolveToneColor(LINE_STYLE_MAP.tool.tone, theme),
                fontSize: 17,
              }}
            >
              {LINE_STYLE_MAP.tool.marker}
            </span>
            <span
              style={{
                color: UI.text,
                fontSize: 17,
                fontWeight: 600,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {line.text}
            </span>
          </div>
          {line.meta ? (
            <span
              style={{
                color: UI.textSoft,
                fontSize: 12,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {line.meta}
            </span>
          ) : null}
        </div>
        {line.details?.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "8px 0 0 0",
              fontFamily: theme.fonts.code,
            }}
          >
            {line.details.map((detail) => (
              <DetailLine key={`${line.text}-${detail.text}`} detail={detail} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (line.type === "approval") {
    return (
      <div
        style={{
          opacity: baseOpacity,
          transform: `translateY(${translateY}px)`,
          padding: "0 0 0 14px",
          borderLeft: `1px solid ${UI.lineSoft}`,
        }}
      >
        <div
          style={{
            color: UI.text,
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.4,
            marginBottom: line.details?.length ? 14 : 0,
          }}
        >
          {line.text}
        </div>
        {line.details?.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {line.details.map((detail, index) => {
              const isSelected = line.selectedIndex === index;

              return (
                <div
                  key={`${line.text}-${detail.text}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0",
                    color: resolveToneColor(
                      detail.tone ?? (isSelected ? "warning" : "default"),
                      theme,
                    ),
                    fontSize: 16,
                  }}
                >
                  <span style={{ opacity: isSelected ? 1 : 0.45 }}>❯</span>
                  <span>{detail.text}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  const style = LINE_STYLE_MAP[line.type];
  const textColor = resolveToneColor(style.tone, theme);
  const visibleText = revealText(line.text, progress);
  const showCursor = progress < 0.98 && (line.type === "prompt" || line.type === "assistant");

  return (
    <div
      style={{
        opacity: baseOpacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        paddingLeft:
          line.type === "result" || line.type === "output" ? 24 : line.type === "command" ? 12 : 0,
        color: textColor,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: line.type === "prompt" ? 18 : 16,
        lineHeight: 1.58,
      }}
    >
      {style.marker ? (
        <span style={{ minWidth: 14, color: textColor }}>{style.marker}</span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>
          {visibleText}
          {showCursor ? (
            <span style={{ color: theme.colors.warning, marginLeft: 4 }}>|</span>
          ) : null}
        </div>
        {line.meta ? (
          <div
            style={{
              marginTop: 4,
              color: UI.textSoft,
              fontSize: 13,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {line.meta}
          </div>
        ) : null}
        {line.details?.length ? (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontFamily: theme.fonts.code,
            }}
          >
            {line.details.map((detail) => (
              <DetailLine key={`${line.text}-${detail.text}`} detail={detail} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const ClaudeCodeComponent: React.FC<CardRenderProps<ClaudeCodeData>> = ({
  data,
  episode,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const session = data.session;
  const cardTitle = data.title ?? "Claude Code";
  const panelProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 120, mass: 0.8 },
  });
  const panelScale = interpolate(panelProgress, [0, 1], [0.97, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelOpacity = interpolate(panelProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const timeline = buildTimeline(data.lines);
  const historyEvents = timeline.filter((event) => frame >= event.historyStart);
  const latestVisibleEvent = historyEvents[historyEvents.length - 1];
  const activeInputEvent = timeline.find(
    (event) =>
      !event.historyOnly &&
      frame >= event.start &&
      frame < (event.inputEnd ?? event.start),
  );
  const topStatus = [
    ...(session?.badges?.map((badge) => badge.label.toLowerCase()) ?? []),
    data.tag?.toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");
  const sessionSlug = slugFromSession(session, "claude-code");
  const focusLine = activeInputEvent?.line ?? latestVisibleEvent?.line;
  const activeWorkflowStage = deriveActiveWorkflowStage(
    session?.workflow,
    data.tag,
    [
      ...historyEvents.map((event) => event.line),
      ...(activeInputEvent ? [activeInputEvent.line] : []),
    ],
  );
  const currentStatus = describeStatus(
    focusLine,
    data.tag,
  );
  const statusCount = `${Math.min(
    data.lines.length,
    historyEvents.length + (activeInputEvent ? 1 : 0),
  )}/${data.lines.length}`;
  const bottomStatusLeft = `[${sessionSlug}:${normalizeVersion(session?.version)}*]`;
  const bottomStatusRight = `"* Claude Code" ${currentStatus} · ${statusCount}`;

  return (
    <BaseSlide
      background={{ kind: "color", value: UI.canvas }}
      padding="none"
      align={{
        justifyContent: "center",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: "4px 0 0",
          boxSizing: "border-box",
          opacity: panelOpacity,
          transform: `scale(${panelScale})`,
        }}
      >
        <div
          style={{
            height: "100%",
            overflow: "hidden",
            background: UI.panel,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "6px 14px 10px",
              borderBottom: `1px solid ${UI.line}`,
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontFamily: theme.fonts.code,
                  color: UI.logo,
                  fontSize: 23,
                  lineHeight: 1.1,
                  letterSpacing: "0.02em",
                  whiteSpace: "pre",
                  paddingTop: 1,
                }}
              >
                {LOGO_LINES.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    flexWrap: "wrap",
                    color: UI.text,
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                    }}
                  >
                    {cardTitle}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      color: UI.textMuted,
                    }}
                  >
                    {session?.version ?? "v2.1.112"}
                  </span>
                </div>
                <div
                  style={{
                    color: UI.textMuted,
                    fontSize: 15,
                    lineHeight: 1.1,
                  }}
                >
                  {session?.model ?? "Sonnet 4.6 with high effort · Claude Max"}
                </div>
                <div
                  style={{
                    color: UI.textSoft,
                    fontFamily: theme.fonts.code,
                    fontSize: 15,
                    lineHeight: 1.1,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {session?.workspace ?? episode.channelName ?? "~/cowork-workspace/ars"}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              padding: "12px 16px 12px",
              display: "flex",
              flexDirection: "column",
              fontFamily: theme.fonts.code,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 8,
                minHeight: "100%",
              }}
            >
              {historyEvents.map((event) => {
                const lineProgress = spring({
                  frame: Math.max(0, frame - event.historyStart),
                  fps,
                  config: { damping: 18, stiffness: 110, mass: 0.7 },
                });

                return (
                  <ClaudeCodeEntry
                    key={`${event.line.type}-${event.historyStart}-${event.line.text}`}
                    line={event.line}
                    progress={lineProgress}
                  />
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 40,
                pointerEvents: "none",
                background:
                  "linear-gradient(180deg, rgba(43,45,53,1) 0%, rgba(43,45,53,0.82) 38%, rgba(43,45,53,0) 100%)",
              }}
            />
          </div>

          <div
            style={{
              padding: "6px 14px 7px",
              borderTop: `1px solid ${UI.line}`,
              background: UI.panel,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: theme.fonts.code,
              color: UI.text,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            <span style={{ color: UI.text }}>&#10095;</span>
            <span style={{ color: UI.text, minHeight: 18 }}>
              {activeInputEvent
                ? `${revealText(
                    activeInputEvent.line.text,
                    interpolate(
                      frame,
                      [activeInputEvent.start, activeInputEvent.inputEnd ?? activeInputEvent.start + 1],
                      [0, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      },
                    ),
                  )}|`
                : "|"}
            </span>
          </div>

          <div
            style={{
              padding: "6px 14px 5px",
              borderTop: `1px solid ${UI.line}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              fontFamily: theme.fonts.code,
              fontSize: 13,
              color: UI.textSoft,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              {session?.appTitle ? <span>{session.appTitle}</span> : null}
              {session?.workflow ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {session.workflow
                    .split("›")
                    .map((stage) => stage.trim())
                    .filter(Boolean)
                    .map((stage, index, stages) => {
                      const normalizedStage = normalizeWorkflowStage(stage);
                      const isActive = normalizedStage === activeWorkflowStage;

                      return (
                        <React.Fragment key={stage}>
                          <span
                            style={{
                              color: isActive ? UI.text : UI.textSoft,
                              fontWeight: isActive ? 700 : 500,
                            }}
                          >
                            {isActive ? `▶${stage}` : stage}
                          </span>
                          {index < stages.length - 1 ? <span>›</span> : null}
                        </React.Fragment>
                      );
                    })}
                </div>
              ) : null}
            </div>
            <div
              style={{
                color: UI.textMuted,
                textAlign: "right",
                flexShrink: 0,
                fontSize: 13,
              }}
            >
              {topStatus}
            </div>
          </div>

          <div
            style={{
              padding: "6px 12px 5px",
              background: "#b7bf68",
              color: "#20242a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              fontFamily: theme.fonts.code,
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            <span>{bottomStatusLeft}</span>
            <span>{bottomStatusRight}</span>
          </div>
        </div>
      </div>
    </BaseSlide>
  );
};
