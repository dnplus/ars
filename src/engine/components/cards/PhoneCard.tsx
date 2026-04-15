import React from "react";
import { MockAppCard } from "./MockAppCard";
import type {
  MockAppArtifact as PhoneArtifact,
  MockAppBadge as PhoneBadge,
  MockAppMessage as PhoneMessage,
} from "./MockAppCard";

export type { PhoneArtifact, PhoneBadge, PhoneMessage };

export type PhoneCardProps = {
  appType?: "claude";
  appName?: string;
  messages: PhoneMessage[];
  charsPerSecond?: number;
  inputPlaceholder?: string;
};

export const PhoneCard: React.FC<PhoneCardProps> = ({
  appName = "Opus 4.6",
  messages,
  charsPerSecond = 14,
  inputPlaceholder = "Reply to Claude…",
}) => (
  <MockAppCard
    device="mobile"
    type="chat"
    variant="claude"
    appName={appName}
    messages={messages}
    charsPerSecond={charsPerSecond}
    inputPlaceholder={inputPlaceholder}
  />
);
