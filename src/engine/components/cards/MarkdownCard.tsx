import React from "react";
import {
  MarkdownCardComponent,
  type MarkdownCardData,
} from "../../cards/markdown/component";
import { normalizeLegacyTagColorToken } from "../../primitives/WindowSlide";
import type { WindowFrameType } from "../ui/WindowFrame";

export type MarkdownCardProps = Omit<MarkdownCardData, "tagColor" | "frame"> & {
  tagColor: string;
  frame?: WindowFrameType;
};

export const MarkdownCard: React.FC<MarkdownCardProps> = ({
  tagColor,
  frame,
  ...rest
}) => {
  return (
    <MarkdownCardComponent
      data={{
        ...rest,
        tagColor: normalizeLegacyTagColorToken(tagColor),
        frame,
      }}
      step={{
        id: "markdown",
        durationInSeconds: 0,
      }}
      episode={{
        title: rest.cardTitle,
      }}
    />
  );
};
