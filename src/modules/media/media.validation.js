import { z } from "zod";

const mediaKindSchema = z.enum(["AUDIO", "VIDEO", "IMAGE", "DOCUMENT"]);

// Validates the non-file fields that come in as multipart/form-data body fields
export const uploadMediaSchema = z.object({
  body: z.object({
    mediaKind: mediaKindSchema,
    durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const listMediaAssetsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    mediaKind: mediaKindSchema.optional(),
    uploadStatus: z.enum(["PENDING", "UPLOADED", "PROCESSING", "READY", "FAILED"]).optional(),
    search: z.string().trim().optional(),
  }),
});

export const mediaAssetIdParamSchema = z.object({
  params: z.object({
    mediaAssetId: z.string().min(1, "mediaAssetId is required"),
  }),
});

export const publicCourseImagePreviewParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Course slug is required"),
    imageType: z.enum(["thumbnail", "banner"]),
  }),
});
