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
  /**
   * 標記此 card 可作為 episode.metadata.thumbnail.variants 的 cardType。
   * 為 true 時，Root.tsx thumbnails Folder 會為每個 variant 動態查 registry 並建立 Still。
   */
  canBeThumbnail?: boolean;
  agentHints?: {
    whenToUse?: string;
    notForUseCases?: string;
    exampleData?: unknown;
  };
}
