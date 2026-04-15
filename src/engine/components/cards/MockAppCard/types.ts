import type { ChartDatum } from "../ChartCard";
import type { StatItem } from "../StatsCard";

export type MockAppArtifact = {
  label: string;
  language?: string;
  preview?: string;
  lines?: string;
};

export type MockAppBadge = {
  label: string;
  value?: string;
  color: string;
};

export type MockAppMessage = {
  role: "user" | "assistant";
  text: string;
  pauseAfter?: number;
  artifact?: MockAppArtifact;
  badges?: MockAppBadge[];
  branch?: string;
  placeholder?: { label: string; color: string; height?: number };
};

export type MockTerminalLine = {
  type: "command" | "output";
  text: string;
  pauseAfter?: number;
};

export type MockAppType =
  | "claude"
  | "chat"
  | "terminal"
  | "browser"
  | "dashboard";

export type MockAppDevice = "desktop" | "mobile";

export type MockAppBrowserMode = "meta" | "snapshot";
export type MockAppBrowserLayout = "normal" | "square" | "mobile";

export type MockAppProps = {
  device?: MockAppDevice;
  type?: MockAppType;
  variant?: "claude";
  appName?: string;
  messages?: MockAppMessage[];
  charsPerSecond?: number;
  inputPlaceholder?: string;
  terminalTitle?: string;
  terminalLines?: MockTerminalLine[];
  terminalCharsPerSecond?: number;
  browserUrl?: string;
  browserImageSrc?: string;
  browserMode?: MockAppBrowserMode;
  browserLayout?: MockAppBrowserLayout;
  dashboardStats?: StatItem[];
  dashboardChartType?: "bar" | "line" | "pie";
  dashboardChartData?: ChartDatum[];
  dashboardValuePrefix?: string;
  dashboardValueSuffix?: string;
  dashboardSourceLabel?: string;
  dashboardInsight?: string;
};
