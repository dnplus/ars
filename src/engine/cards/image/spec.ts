import { ImageCardComponent, type ImageCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "image",
  title: "Image",
  description: "Windowed image viewer for screenshots, diagrams, and still visuals.",
  schemaVersion: 1,
  defaults: {
    objectFit: "contain",
    frame: "mac",
  } satisfies Partial<ImageCardData>,
  component: ImageCardComponent,
  agentHints: {
    whenToUse: "Use for screenshots, diagrams, memes, or visual evidence that should stay static.",
    notForUseCases: "Not for live embeds, animated scenes, or syntax-heavy code samples.",
    exampleData: {
      title: "Architecture Diagram",
      src: "/episodes/template/example.png",
      objectFit: "contain",
    },
  },
  status: "active",
} satisfies CardSpec<ImageCardData>;
