import { ImageCardComponent, type ImageCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "image",
  title: "Image",
  description: "Windowed image viewer for screenshots, diagrams, and still visuals.",
  defaults: {
    objectFit: "contain",
    frame: "mac",
  } satisfies Partial<ImageCardData>,
  component: ImageCardComponent,
  agentHints: {
    whenToUse: "Use for screenshots, diagrams, memes, or visual evidence that should stay static. If the final asset is not ready yet, set src to an explicit PLACEHOLDER_ filename so Studio shows a clear placeholder card instead of silently failing.",
    notForUseCases: "Not for live embeds, animated scenes, or syntax-heavy code samples. Do not leave src empty when the user still needs to provide an image.",
    exampleData: {
      title: "Architecture Diagram (placeholder)",
      src: "/episodes/template/PLACEHOLDER_architecture-diagram.png",
      objectFit: "contain",
    },
  },
} satisfies CardSpec<ImageCardData>;
