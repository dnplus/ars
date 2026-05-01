import { ThumbnailCardComponent } from "./component";
import { thumbnailDataSchema } from "./schema";
import type { CardSpec } from "../types";
import type { ThumbnailData } from "../../shared/types";

export const cardSpec = {
  type: "thumbnail",
  title: "Thumbnail",
  description: "YouTube thumbnail Still — 1280×720，用於 npx ars export thumbnail 輸出 PNG。",
  schema: thumbnailDataSchema,
  defaults: {} satisfies Partial<ThumbnailData>,
  component: ThumbnailCardComponent,
  canBeThumbnail: true,
  agentHints: {
    whenToUse: [
      "Use only for episode.metadata.thumbnail.variants[].data — Still composition, not a video step.",
      "YT A/B test: up to 3 variants. Create visually distinct candidates by varying title length AND mascotUrl (not just wording).",
      "mascotUrl opt-out: set mascotUrl: 'none' to hide the mascot; Classic layout then centers title full-width.",
      "Leave mascotUrl unset to auto-inject shell.config.vtuber.openImg.",
      "A/B playbook — v1: direct title + mascot; v2: rhetorical hook + mascotUrl:'none'; v3: 3–4 char punch title + mascotUrl:'none' to trigger max font size.",
    ].join(" "),
    notForUseCases: "Not for normal in-video story beats. It may appear in ep-demo/onboard gallery to preview the thumbnail surface, but production episodes should reference it through metadata.thumbnail.variants[].data rather than steps[].",
    exampleData: {
      title: "Context Window 失憶症",
      subtitle: "AI 為什麼記不住你？",
      channelName: "人蔘 Try Catch",
      episodeTag: "EP01",
    },
  },
} satisfies CardSpec<ThumbnailData>;
