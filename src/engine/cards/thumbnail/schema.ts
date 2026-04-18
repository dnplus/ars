import { z } from "zod";
import type { ThumbnailData } from "../../shared/types";

export const thumbnailDataSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  channelName: z.string().optional(),
  episodeTag: z.string().optional(),
  mascotUrl: z.string().optional(),
}) satisfies z.ZodType<ThumbnailData>;
