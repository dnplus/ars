import type { ComponentType } from "react";
import type { ZodType } from "zod";
import type { LayoutMode } from "../shared/types";

export type CardRenderProps<TData> = {
  data: TData;
  step: {
    id: string;
    durationInSeconds: number;
    narration?: string;
    layoutMode?: LayoutMode;
  };
  episode: {
    title: string;
    subtitle?: string;
    channelName?: string;
    episodeTag?: string;
  };
};

export interface CardSpec<TData> {
  type: string;
  title: string;
  description: string;
  schema?: ZodType<TData>;
  defaults?: Partial<TData>;
  component: ComponentType<CardRenderProps<TData>>;
  agentHints?: {
    whenToUse?: string;
    notForUseCases?: string;
    exampleData?: unknown;
  };
}
