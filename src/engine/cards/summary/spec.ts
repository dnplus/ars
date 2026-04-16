import { SummaryCardComponent, type SummaryCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "summary",
  title: "Summary",
  description: "Full-bleed recap card for endings, chapter wrap-ups, and CTA screens.",
  defaults: {
    showCta: true,
  } satisfies Partial<SummaryCardData>,
  component: SummaryCardComponent,
  agentHints: {
    whenToUse: "Use for episode endings, chapter recaps, or a final list of takeaways.",
    notForUseCases: "Not for dense body copy or content that should scroll.",
    exampleData: {
      title: "What To Remember",
      points: [
        "One repo maps to one active series.",
        "Plan before build so artifacts stay stable.",
        "Keep card types narrow and reusable.",
      ],
    },
  },
} satisfies CardSpec<SummaryCardData>;
