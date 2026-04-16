import { MermaidCardComponent, type MermaidCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "mermaid",
  title: "Mermaid",
  description: "Diagram card that renders Mermaid charts inside a windowed canvas.",
  defaults: {
    frame: "mac",
  } satisfies Partial<MermaidCardData>,
  component: MermaidCardComponent,
  agentHints: {
    whenToUse: "Use for flowcharts, sequence diagrams, and lightweight system maps.",
    notForUseCases: "Not for giant architecture dumps or charts that work better as static images.",
    exampleData: {
      title: "Workflow",
      chart: "graph TD\n  A[Plan] --> B[Build]\n  B --> C[Review]",
    },
  },
} satisfies CardSpec<MermaidCardData>;
