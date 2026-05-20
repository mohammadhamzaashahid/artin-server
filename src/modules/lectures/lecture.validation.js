import { z } from "zod";

const lectureStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const createLectureSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
  body: z.object({
    title: z.string().trim().min(2, "Lecture title is required").max(180),
    description: z.string().trim().max(5000).optional().nullable(),
    lectureOrder: z.coerce.number().int().positive().optional(),
    isPreviewFree: z.boolean().default(false),
    status: lectureStatusSchema.default("DRAFT"),
    audioMediaAssetId: z.string().optional().nullable(),
    videoMediaAssetId: z.string().optional().nullable(),
    durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const listLecturesByCourseSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
  query: z.object({
    includeDeleted: z.enum(["true", "false"]).default("false"),
  }),
});

export const lectureIdParamSchema = z.object({
  params: z.object({
    lectureId: z.string().min(1, "Lecture ID is required"),
  }),
});

export const updateLectureSchema = z.object({
  params: z.object({
    lectureId: z.string().min(1, "Lecture ID is required"),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(180).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    lectureOrder: z.coerce.number().int().positive().optional(),
    isPreviewFree: z.boolean().optional(),
    status: lectureStatusSchema.optional(),
    audioMediaAssetId: z.string().optional().nullable(),
    videoMediaAssetId: z.string().optional().nullable(),
    durationSeconds: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const reorderLecturesSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
  body: z.object({
    lectures: z
      .array(
        z.object({
          lectureId: z.string().min(1, "lectureId is required"),
          lectureOrder: z.coerce.number().int().positive("lectureOrder must be positive"),
        })
      )
      .default([]),
  }),
});
