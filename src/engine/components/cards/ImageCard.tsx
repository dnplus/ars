import React from "react";
import {
  ImageCardComponent,
  type ImageCardData,
} from "../../cards/image/component";
import type { WindowFrameType } from "../ui/WindowFrame";

export type ImageCardProps = Omit<ImageCardData, "frame"> & {
  frame?: WindowFrameType;
};

export const ImageCard: React.FC<ImageCardProps> = (props) => {
  return (
    <ImageCardComponent
      data={props}
      step={{
        id: "image",
        durationInSeconds: 0,
      }}
      episode={{
        title: props.title || "Image Viewer",
      }}
    />
  );
};
