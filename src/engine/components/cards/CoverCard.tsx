import React from "react";
import {
  CoverCardComponent,
  type CoverCardData,
} from "../../cards/cover/component";

export type CoverCardProps = CoverCardData & {
  title: string;
};

export const CoverCard: React.FC<CoverCardProps> = (props) => {
  return (
    <CoverCardComponent
      data={props}
      step={{
        id: "cover",
        durationInSeconds: 0,
      }}
      episode={{
        title: props.title,
        subtitle: props.subtitle,
        channelName: props.channelName,
        episodeTag: props.episodeTag,
      }}
    />
  );
};
