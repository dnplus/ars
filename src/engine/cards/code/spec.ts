import { CodeCardComponent, type CodeCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "code",
  title: "Code",
  description: "Scrollable syntax-highlighted code card for snippets and configs.",
  defaults: {
    language: "tsx",
    showLineNumbers: true,
  } satisfies Partial<CodeCardData>,
  component: CodeCardComponent,
  agentHints: {
    whenToUse: "Use for source code, shell commands, configs, or diffs that need syntax emphasis.",
    notForUseCases: "Not for prose-heavy explanations or screenshots of UI.",
    exampleData: {
      title: "server.ts",
      language: "ts",
      code: "export const handler = () => 'ok';",
    },
  },
} satisfies CardSpec<CodeCardData>;
