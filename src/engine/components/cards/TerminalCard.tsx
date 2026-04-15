import React from "react";
import { MockAppCard } from "./MockAppCard";
import type { MockTerminalLine as TerminalLine } from "./MockAppCard";

export type { TerminalLine };

export type TerminalCardProps = {
  title?: string;
  lines: TerminalLine[];
  charsPerSecond?: number;
};

export const TerminalCard: React.FC<TerminalCardProps> = ({
  title = "Terminal",
  lines,
  charsPerSecond = 26,
}) => (
  <MockAppCard
    device="desktop"
    type="terminal"
    appName={title}
    terminalTitle={title}
    terminalLines={lines}
    terminalCharsPerSecond={charsPerSecond}
  />
);
