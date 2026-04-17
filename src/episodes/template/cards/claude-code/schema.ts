import { z } from "zod";

const ClaudeCodeLineSchema = z.object({
  type: z.enum(["prompt", "command", "output", "success", "error", "info"]),
  text: z.string(),
});

export const ClaudeCodeSchema = z.object({
  title: z.string().optional(),
  tag: z.string().optional(),
  lines: z.array(ClaudeCodeLineSchema),
});

export type ClaudeCodeData = z.infer<typeof ClaudeCodeSchema>;
