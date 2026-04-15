import { MarkdownCardComponent, type MarkdownCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "markdown",
  title: "Markdown",
  description: "Scrollable rich-text card with GitHub-flavored Markdown support.",
  schemaVersion: 1,
  component: MarkdownCardComponent,
  agentHints: {
    whenToUse: "Use for structured notes, tables, bullet lists, or explanatory prose.",
    notForUseCases: "Not for large diagrams or syntax-sensitive code snippets.",
    exampleData: {
      cardTitle: "Checklist",
      cardTag: "Guide",
      tagColor: "info",
      content: "- Point A\n- Point B\n- Point C",
    },
  },
  status: "active",
} satisfies CardSpec<MarkdownCardData>;
