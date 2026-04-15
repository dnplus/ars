import React from "react";
import { MockAppCard } from "./MockAppCard";
import type { MockAppMessage as PhoneMessage } from "./MockAppCard";

export type MacAppCardProps = {
  appType?: "claude";
  appName?: string;
  messages: PhoneMessage[];
  charsPerSecond?: number;
  inputPlaceholder?: string;
};

export const MacAppCard: React.FC<MacAppCardProps> = ({
  appName = "AI Assistant Desktop",
  messages,
  charsPerSecond = 20,
  inputPlaceholder = "Message Assistant...",
}) => (
  <MockAppCard
    device="desktop"
    type="chat"
    variant="claude"
    appName={appName}
    messages={messages}
    charsPerSecond={charsPerSecond}
    inputPlaceholder={inputPlaceholder}
  />
);
