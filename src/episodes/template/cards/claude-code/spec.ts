import { ClaudeCodeComponent } from "./component";
import { ClaudeCodeSchema } from "./schema";
import type { CardSpec } from "../../../../engine/cards/types";
import type { ClaudeCodeData } from "./schema";

export const cardSpec = {
  type: "claude-code",
  title: "Claude Code",
  description: "Displays a mock Claude Code session with prompts, tool cards, approvals, and transcript beats.",
  component: ClaudeCodeComponent,
  schema: ClaudeCodeSchema,
} satisfies CardSpec<ClaudeCodeData>;
