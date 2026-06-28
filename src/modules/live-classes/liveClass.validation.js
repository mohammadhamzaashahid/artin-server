import { z } from "zod";

const liveClassStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const createLiveClassSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, "Class title is required").max(180),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen-separated")
      .optional(),
    description: z.string().trim().max(10000).optional().nullable(),
    startDate: z.string().datetime({ message: "startDate must be a valid ISO 8601 datetime" }),
    endDate: z.string().datetime({ message: "endDate must be a valid ISO 8601 datetime" }),
    timeDuration: z.coerce
      .number()
      .int()
      .positive("timeDuration must be a positive integer (minutes)"),
    joiningLink: z.string().trim().url("joiningLink must be a valid URL").optional().nullable(),
    bannerImageAssetId: z.string().optional().nullable(),
    preparatoryMaterialIds: z.array(z.string()).default([]),
    courseId: z.string().optional().nullable(),
  }),
});

export const updateLiveClassSchema = z.object({
  params: z.object({
    liveClassId: z.string().min(1, "Live class ID is required"),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(180).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen-separated")
      .optional(),
    description: z.string().trim().max(10000).optional().nullable(),
    startDate: z
      .string()
      .datetime({ message: "startDate must be a valid ISO 8601 datetime" })
      .optional(),
    endDate: z
      .string()
      .datetime({ message: "endDate must be a valid ISO 8601 datetime" })
      .optional(),
    timeDuration: z.coerce.number().int().positive().optional(),
    joiningLink: z.string().trim().url("joiningLink must be a valid URL").optional().nullable(),
    bannerImageAssetId: z.string().optional().nullable(),
    preparatoryMaterialIds: z.array(z.string()).optional(),
    courseId: z.string().optional().nullable(),
    status: liveClassStatusSchema.optional(),
  }),
});

export const liveClassIdParamSchema = z.object({
  params: z.object({
    liveClassId: z.string().min(1, "Live class ID is required"),
  }),
});

export const liveClassSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Live class slug is required"),
  }),
});

export const listAdminLiveClassesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    status: liveClassStatusSchema.optional(),
    courseId: z.string().optional(),
    includeDeleted: z.enum(["true", "false"]).default("false"),
  }),
});

export const listPublicLiveClassesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12),
    search: z.string().trim().optional(),
    courseId: z.string().optional(),
  }),
});

export const createLiveClassPriceSchema = z.object({
  params: z.object({
    liveClassId: z.string().min(1, "Live class ID is required"),
  }),
  body: z.object({
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    currency: z.string().trim().length(3, "Currency must be 3 characters").default("USD"),
    stripeProductId: z.string().trim().optional().nullable(),
    stripePriceId: z.string().trim().optional().nullable(),
    isActive: z.boolean().default(true),
  }),
});

export const updateLiveClassPriceSchema = z.object({
  params: z.object({
    priceId: z.string().min(1, "Price ID is required"),
  }),
  body: z.object({
    amount: z.coerce.number().positive().optional(),
    currency: z.string().trim().length(3).optional(),
    stripeProductId: z.string().trim().optional().nullable(),
    stripePriceId: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const liveClassPriceIdParamSchema = z.object({
  params: z.object({
    priceId: z.string().min(1, "Price ID is required"),
  }),
});
