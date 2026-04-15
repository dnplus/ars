import React from "react";

type SocialCoverVariant = "single" | "opener";

export type SocialCoverCardProps = {
  title: string;
  subtitle?: string;
  channelName?: string;
  episodeTag?: string;
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
    surfaceLight: string;
    onLight: string;
    border: string;
  };
  width?: number;
  height?: number;
  variant?: SocialCoverVariant;
};

const DEFAULT_THEME = {
  primary: "#c4a77d",
  secondary: "#6b5d4d",
  accent: "#d4b896",
  surfaceLight: "#f5f0e8",
  onLight: "#3d3530",
  border: "#d9cbb7",
};

const splitTitleLines = (title: string, variant: SocialCoverVariant): string[] => {
  const stripped = title
    .replace(/\s+/g, " ")
    .replace(/[！？。，、；：「」『』（）【】《》〈〉]/g, " ")
    .trim();

  const maxChars = variant === "single" ? 16 : 10;
  const words = stripped.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, variant === "single" ? 3 : 5);
};

export const SocialCoverCard: React.FC<SocialCoverCardProps> = ({
  title,
  subtitle,
  channelName = "Your Channel",
  episodeTag,
  theme: userTheme,
  width = 1080,
  height = 1350,
  variant = "single",
}) => {
  const t = { ...DEFAULT_THEME, ...userTheme };
  const titleLines = splitTitleLines(title, variant);
  const headerTag = variant === "single" ? "人蔘觀點" : "Carousel Opener";
  const rightTag = episodeTag || "世界模型";

  const titleFontSize =
    variant === "single"
      ? titleLines.length >= 3
        ? 78
        : 88
      : titleLines.length >= 5
        ? 74
        : 86;

  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(180deg, ${t.surfaceLight} 0%, #ecdfcb 100%)`,
        fontFamily: '"Noto Sans TC", sans-serif',
        color: t.onLight,
        padding: 28,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 30,
          background: "#fcfaf6",
          border: `2px solid ${t.border}`,
          boxShadow: "0 24px 60px rgba(45,40,35,0.12)",
          padding: variant === "single" ? "56px 54px" : "52px 54px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: variant === "single" ? 48 : 38,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 26px",
              borderRadius: 999,
              background: "#e8efe7",
              color: "#49644c",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            {headerTag}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                padding: "10px 22px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                color: "#fff",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {rightTag}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["</>", "△", "⌂"].map((icon, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    background: idx === 1 ? "#e7efe2" : "#eee4d6",
                    color: idx === 1 ? "#59784f" : t.secondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 17,
                    fontWeight: 900,
                  }}
                >
                  {icon}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: titleFontSize,
            lineHeight: 1.08,
            fontWeight: 900,
            letterSpacing: -2.5,
          }}
        >
          {titleLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: variant === "single" ? 34 : 28,
            marginBottom: variant === "single" ? 34 : 28,
          }}
        >
          <div style={{ width: 210, height: 16, borderRadius: 999, background: "#d8c6ad" }} />
          <div style={{ width: 128, height: 16, borderRadius: 999, background: "#ece2d3" }} />
          <div style={{ width: 214, height: 16, borderRadius: 999, background: "#d8c6ad" }} />
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: variant === "single" ? 28 : 26,
              lineHeight: 1.45,
              fontWeight: 800,
              color: t.secondary,
              maxWidth: "90%",
            }}
          >
            {subtitle}
          </div>
        ) : null}

        <div style={{ marginTop: "auto" }}>
          <div style={{ height: 2, background: "#e0d2be", marginBottom: 28 }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 22,
              fontWeight: 700,
              color: "#7a6e62",
            }}
          >
            <div>{channelName}</div>
            <div>{variant === "single" ? "Social Single Cover" : "Carousel Opener"}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
