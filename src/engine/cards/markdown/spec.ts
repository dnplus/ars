import { MarkdownCardComponent } from "./component";
import { MarkdownCardSchema, type MarkdownCardData } from "./schema";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "markdown",
  title: "Markdown",
  description: "Scrollable rich-text card with GitHub-flavored Markdown support.",
  schema: MarkdownCardSchema,
  component: MarkdownCardComponent,
  agentHints: {
    whenToUse: "Use for structured notes, tables, bullet lists, or explanatory prose. Do not set cardTag/tagColor; those fields are deprecated and ignored.",
    notForUseCases: "Not for large diagrams, syntax-sensitive code snippets, or visual categories that rely on a right-side card tag.",
    exampleData: {
      cardTitle: "Checklist",
      content: "- Point A\n- Point B\n- Point C",
    },
  },
} satisfies CardSpec<MarkdownCardData>;
