import { z } from "zod";

export const ClaudeCodeToneSchema = z.enum([
  "default",
  "muted",
  "positive",
  "negative",
  "warning",
  "highlight",
  "info",
]);

export const ClaudeCodeBadgeSchema = z.object({
  label: z.string(),
  tone: ClaudeCodeToneSchema.optional(),
});

export const ClaudeCodeDetailSchema = z.object({
  text: z.string(),
  tone: ClaudeCodeToneSchema.optional(),
});

export const ClaudeCodeLineSchema = z.object({
  type: z.enum([
    "prompt",
    "command",
    "output",
    "success",
    "error",
    "info",
    "assistant",
    "result",
    "tool",
    "approval",
    "section",
  ]),
  text: z.string(),
  meta: z.string().optional(),
  details: z.array(ClaudeCodeDetailSchema).optional(),
  selectedIndex: z.number().int().nonnegative().optional(),
});

export const ClaudeCodeSessionSchema = z.object({
  appTitle: z.string().optional(),
  workflow: z.string().optional(),
  version: z.string().optional(),
  model: z.string().optional(),
  workspace: z.string().optional(),
  badges: z.array(ClaudeCodeBadgeSchema).optional(),
});

export const ClaudeCodeSchema = z.object({
  title: z.string().optional(),
  tag: z.string().optional(),
  session: ClaudeCodeSessionSchema.optional(),
  lines: z.array(ClaudeCodeLineSchema),
});

export type ClaudeCodeTone = z.infer<typeof ClaudeCodeToneSchema>;
export type ClaudeCodeBadge = z.infer<typeof ClaudeCodeBadgeSchema>;
export type ClaudeCodeDetail = z.infer<typeof ClaudeCodeDetailSchema>;
export type ClaudeCodeLine = z.infer<typeof ClaudeCodeLineSchema>;
export type ClaudeCodeSession = z.infer<typeof ClaudeCodeSessionSchema>;
export type ClaudeCodeData = z.infer<typeof ClaudeCodeSchema>;
