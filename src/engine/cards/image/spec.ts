import { ImageCardComponent, type ImageCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "image",
  title: "Image",
  description: "Windowed image viewer for screenshots, diagrams, and still visuals.",
  defaults: {
    objectFit: "contain",
  } satisfies Partial<ImageCardData>,
  component: ImageCardComponent,
  agentHints: {
    whenToUse: "Use for screenshots, diagrams, memes, or visual evidence that should stay static. Default renders fullscreen with no window chrome or title — the image fills the slide. Set `frame: 'mac' | 'browser' | 'terminal'` only when the window metaphor is part of the message (e.g. showing a UI inside its native chrome). If the final asset is not ready yet, set src to an explicit PLACEHOLDER_ filename so Studio shows a clear placeholder card instead of silently failing. The `caption` field is only rendered in placeholder state — use it to describe what asset is still needed (e.g. `caption: 'NEEDS: before/after composite'`). For real images the visual speaks for itself, so leave caption blank.",
    notForUseCases: "Not for live embeds, animated scenes, or syntax-heavy code samples. Do not leave src empty when the user still needs to provide an image. Do not use caption as a sub-title for real images — it is a placeholder-only field. Do not set `frame` just to add decoration; it should only be used when the chrome itself is part of the narrative.",
    exampleData: {
      src: "/episodes/template/PLACEHOLDER_architecture-diagram.png",
      caption: "NEEDS: system architecture diagram with request flow",
    },
  },
} satisfies CardSpec<ImageCardData>;
