import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ChatView } from "./chat";
import { DashboardView } from "./dashboard";
import { BrowserView } from "./browser";
import { TerminalView } from "./terminal";
import {
  defaultAppName,
  getResolvedType,
} from "./shared";
import type { MockAppProps } from "./types";

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          height: "96%",
          aspectRatio: "9 / 18.5",
          borderRadius: 48,
          backgroundColor: "#111",
          padding: 5,
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -3,
            top: "22%",
            width: 4,
            height: 48,
            borderRadius: "0 3px 3px 0",
            backgroundColor: "#222",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: "18%",
            width: 4,
            height: 32,
            borderRadius: "3px 0 0 3px",
            backgroundColor: "#222",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: "26%",
            width: 4,
            height: 32,
            borderRadius: "3px 0 0 3px",
            backgroundColor: "#222",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            backgroundColor: "#292929",
            borderRadius: 44,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 96,
              height: 26,
              backgroundColor: "#000",
              borderRadius: 13,
              zIndex: 10,
            }}
          />
          {children}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                width: 120,
                height: 5,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.38)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopFrame({
  title,
  type,
  children,
}: {
  title: string;
  type: "chat" | "terminal" | "browser" | "dashboard";
  children: React.ReactNode;
}) {
  const headerTag =
    type === "terminal"
      ? "TERM"
      : type === "browser"
        ? "WEB"
        : type === "dashboard"
          ? "DATA"
          : "APP";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 16,
          backgroundColor: "#1e1e1e",
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 32,
            backgroundColor: "#2d2d2d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#ed6a5e",
              }}
            />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#f5bf4f",
              }}
            />
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#61c554",
              }}
            />
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              color: "#8fd3ff",
              backgroundColor: "rgba(125,211,252,0.12)",
            }}
          >
            {headerTag}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const MockAppCard: React.FC<MockAppProps> = ({
  device = "desktop",
  type = "chat",
  variant,
  appName,
  messages = [],
  charsPerSecond = device === "mobile" ? 14 : 20,
  inputPlaceholder,
  terminalTitle,
  terminalLines = [],
  terminalCharsPerSecond = 26,
  browserUrl,
  browserImageSrc,
  browserMode = "meta",
  browserLayout = "normal",
  dashboardStats = [],
  dashboardChartType = "bar",
  dashboardChartData = [],
  dashboardValuePrefix,
  dashboardValueSuffix,
  dashboardSourceLabel,
  dashboardInsight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const resolvedType = getResolvedType(variant ?? type);
  const resolvedName = appName || defaultAppName(device, resolvedType);
  const placeholder =
    inputPlaceholder ||
    (device === "mobile" ? "Reply to Claude…" : "Message Assistant...");

  const content =
    resolvedType === "terminal" ? (
      <TerminalView
        lines={terminalLines}
        charsPerSecond={terminalCharsPerSecond}
        frame={frame}
        fps={fps}
      />
    ) : resolvedType === "browser" ? (
      <BrowserView
        device={device}
        url={browserUrl}
        imageSrc={browserImageSrc}
        mode={browserMode}
        layout={browserLayout}
      />
    ) : resolvedType === "dashboard" ? (
      <DashboardView
        stats={dashboardStats}
        chartType={dashboardChartType}
        chartData={dashboardChartData}
        valuePrefix={dashboardValuePrefix}
        valueSuffix={dashboardValueSuffix}
        sourceLabel={dashboardSourceLabel}
        insight={dashboardInsight}
      />
    ) : (
      <ChatView
        device={device}
        appName={resolvedName}
        messages={messages}
        charsPerSecond={charsPerSecond}
        inputPlaceholder={placeholder}
        frame={frame}
        fps={fps}
      />
    );

  if (device === "mobile") {
    return <MobileFrame>{content}</MobileFrame>;
  }

  if (resolvedType === "browser") {
    return content;
  }

  return <DesktopFrame title={terminalTitle || resolvedName} type={resolvedType}>{content}</DesktopFrame>;
};

export type {
  MockAppArtifact,
  MockAppBadge,
  MockAppBrowserLayout,
  MockAppBrowserMode,
  MockAppDevice,
  MockAppMessage,
  MockAppProps,
  MockAppType,
  MockTerminalLine,
} from "./types";
