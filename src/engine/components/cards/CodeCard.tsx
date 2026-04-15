import React from "react";
import {
  CodeCardComponent,
  type CodeCardData,
} from "../../cards/code/component";
import type { WindowFrameType } from "../ui/WindowFrame";

export type CodeCardProps = Omit<CodeCardData, "frame"> & {
  frame?: WindowFrameType;
};

export const CodeCard: React.FC<CodeCardProps> = (props) => {
  return (
    <CodeCardComponent
      data={props}
      step={{
        id: "code",
        durationInSeconds: 0,
      }}
      episode={{
        title: props.title || `${props.language || "tsx"} snippet`,
      }}
    />
  );
};
