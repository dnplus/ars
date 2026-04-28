import { z } from "zod";

export const MarkdownCardSchema = z.object({
  cardTitle: z.string(),
  content: z.string(),
  frame: z.enum(["mac", "terminal", "browser", "simple", "none"]).optional(),
  /** @deprecated Legacy window-header tag. Ignored by the renderer; use the step phase/title header instead. */
  cardTag: z
    .string()
    .optional()
    .describe("@deprecated Legacy window-header tag. Ignored by the renderer; use the step phase/title header instead."),
  /** @deprecated Legacy window-header tag color. Ignored by the renderer. */
  tagColor: z
    .string()
    .optional()
    .describe("@deprecated Legacy window-header tag color. Ignored by the renderer."),
});

export type MarkdownCardData = z.infer<typeof MarkdownCardSchema>;
