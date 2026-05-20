import { z } from "zod";

const mediaKindSchema = z.enum(["AUDIO", "VIDEO", "IMAGE"]);

const allowedMimeTypes = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const createUploadUrlSchema = z.object({
  body: z.object({
    mediaKind: mediaKindSchema,
    fileName: z.string().trim().min(1, "fileName is required").max(255),
    mimeType: z
      .string()
      .trim()
      .min(1, "mimeType is required")
      .refine((value) => allowedMimeTypes.includes(value), {
        message: "Unsupported file type",
      }),
    fileSizeBytes: z.coerce.number().int().positive("fileSizeBytes must be positive"),
    durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const completeUploadSchema = z.object({
  body: z.object({
    mediaAssetId: z.string().min(1, "mediaAssetId is required"),
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