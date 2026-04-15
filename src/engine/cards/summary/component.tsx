import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { BaseSlide } from "../../primitives/BaseSlide";
import { useTheme } from "../../shared/ThemeContext";
import type { CardRenderProps } from "../types";

export type SummaryCardButton = {
  label: string;
  icon?: string;
};

export type SummaryCardQrCode = {
  url: string;
  title?: string;
  subtitle?: string;
};

export type SummaryCardData = {
  title: string;
  points: string[];
  ctaButtons?: SummaryCardButton[];
  qrCodes?: SummaryCardQrCode[];
  showCta?: boolean;
};

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u;

const parsePoint = (point: string) => {
  const match = point.match(EMOJI_RE);

  if (!match) {
    return {
      icon: "•",
      label: point,
    };
  }

  return {
    icon: match[0].trim(),
    label: point.slice(match[0].length),
  };
};

export const SummaryCardComponent: React.FC<
  CardRenderProps<SummaryCardData>
> = ({ data }) => {
  const theme = useTheme();
  const showQrCodes = (data.showCta ?? true) && (data.qrCodes?.length ?? 0) > 0;
  const showButtons =
    (data.showCta ?? true) && !showQrCodes && (data.ctaButtons?.length ?? 0) > 0;

  return (
    <BaseSlide
      background={{ kind: "theme", token: "gradientDark" }}
      padding="xl"
      align={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1260,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.08,
            color: theme.colors.onDark,
            letterSpacing: "-0.03em",
          }}
        >
          {data.title}
        </div>

        <div
          style={{
            display: "grid",
            gap: 18,
          }}
        >
          {data.points.map((point, index) => {
            const parsed = parsePoint(point);

            return (
              <div
                key={`${point}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: 18,
                  alignItems: "start",
                  padding: "22px 26px",
                  borderRadius: 24,
                  background: "rgba(18, 17, 16, 0.34)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    lineHeight: 1.1,
                    textAlign: "center",
                  }}
                >
                  {parsed.icon}
                </div>
                <div
                  style={{
                    fontSize: 32,
                    lineHeight: 1.45,
                    fontWeight: 600,
                    color: theme.colors.onDark,
                  }}
                >
                  {parsed.label}
                </div>
              </div>
            );
          })}
        </div>

        {showButtons ? (
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            {data.ctaButtons?.map((button, index) => (
              <div
                key={`${button.label}-${index}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 22px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  color: theme.colors.onDark,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {button.icon ? <span>{button.icon}</span> : null}
                <span>{button.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {showQrCodes ? (
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            {data.qrCodes?.slice(0, 3).map((qrCode, index) => (
              <div
                key={`${qrCode.url}-${index}`}
                style={{
                  minWidth: 240,
                  padding: 20,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  display: "grid",
                  gap: 14,
                  justifyItems: "center",
                }}
              >
                <div
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background: "#ffffff",
                  }}
                >
                  <QRCodeSVG value={qrCode.url} size={160} />
                </div>
                {qrCode.title ? (
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: theme.colors.onDark,
                      textAlign: "center",
                    }}
                  >
                    {qrCode.title}
                  </div>
                ) : null}
                {qrCode.subtitle ? (
                  <div
                    style={{
                      fontSize: 18,
                      lineHeight: 1.45,
                      color: theme.colors.textLight,
                      textAlign: "center",
                    }}
                  >
                    {qrCode.subtitle}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </BaseSlide>
  );
};
