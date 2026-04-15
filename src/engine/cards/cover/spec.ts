import { CoverCardComponent, type CoverCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "cover",
  title: "Cover",
  description: "Full-bleed title slide for episode intros and chapter resets.",
  schemaVersion: 1,
  defaults: {
    animation: "none",
  } satisfies Partial<CoverCardData>,
  component: CoverCardComponent,
  agentHints: {
    whenToUse: "Use for episode openings, major section breaks, or dramatic resets.",
    notForUseCases: "Not for dense explanatory content or code walkthroughs.",
    exampleData: {
      title: "Why Context Windows Fail",
      subtitle: "A systems view of long-horizon memory",
      animation: "matrix",
    },
  },
  status: "active",
} satisfies CardSpec<CoverCardData>;
