import { z } from "zod";

const bookAudioStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const createBookAudioFileSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
  body: z.object({
    title: z.string().trim().min(2, "Title is required").max(180),
    description: z.string().trim().max(5000).optional().nullable(),
    audioOrder: z.coerce.number().int().positive().optional(),
    isPreviewFree: z.boolean().default(false),
    status: bookAudioStatusSchema.default("DRAFT"),
    audioMediaAssetId: z.string().optional().nullable(),
    durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const updateBookAudioFileSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
    audioFileId: z.string().min(1, "Audio file ID is required"),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(180).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    audioOrder: z.coerce.number().int().positive().optional(),
    isPreviewFree: z.boolean().optional(),
    status: bookAudioStatusSchema.optional(),
    audioMediaAssetId: z.string().optional().nullable(),
    durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const bookAudioParamsSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
    audioFileId: z.string().min(1, "Audio file ID is required"),
  }),
});

export const listBookAudioFilesSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
  query: z.object({
    includeDeleted: z.enum(["true", "false"]).default("false"),
  }),
});

export const reorderBookAudioFilesSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
  body: z.object({
    audioFiles: z
      .array(
        z.object({
          audioFileId: z.string().min(1),
          audioOrder: z.number().int().positive(),
        })
      )
      .min(1, "At least one audio file is required"),
  }),
});

export const audioFilePlaybackParamsSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
    audioFileId: z.string().min(1, "Audio file ID is required"),
  }),
});
