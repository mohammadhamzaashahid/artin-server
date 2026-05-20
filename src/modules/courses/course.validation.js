import { z } from "zod";

const courseStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const priceTypeSchema = z.enum(["ONE_TIME", "SUBSCRIPTION"]);
const billingIntervalSchema = z.enum(["MONTH", "YEAR"]);

export const createCourseSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, "Course title is required").max(180),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen-separated")
      .optional(),
    subtitle: z.string().trim().max(220).optional().nullable(),
    shortDescription: z.string().trim().max(500).optional().nullable(),
    description: z.string().trim().max(10000).optional().nullable(),
    categoryId: z.string().optional().nullable(),
    tagIds: z.array(z.string()).default([]),
    thumbnailImageAssetId: z.string().optional().nullable(),
    bannerImageAssetId: z.string().optional().nullable(),
  }),
});

export const updateCourseSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
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
    subtitle: z.string().trim().max(220).optional().nullable(),
    shortDescription: z.string().trim().max(500).optional().nullable(),
    description: z.string().trim().max(10000).optional().nullable(),
    categoryId: z.string().optional().nullable(),
    tagIds: z.array(z.string()).optional(),
    thumbnailImageAssetId: z.string().optional().nullable(),
    bannerImageAssetId: z.string().optional().nullable(),
    status: courseStatusSchema.optional(),
  }),
});

export const courseIdParamSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
});

export const listAdminCoursesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    status: courseStatusSchema.optional(),
    categoryId: z.string().optional(),
    includeDeleted: z.enum(["true", "false"]).default("false"),
  }),
});

export const listPublicCoursesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    tag: z.string().trim().optional(),
  }),
});

export const courseSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Course slug is required"),
  }),
});

export const createCoursePriceSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
  body: z
    .object({
      priceType: priceTypeSchema,
      amount: z.coerce.number().positive("Amount must be greater than 0"),
      currency: z.string().trim().length(3, "Currency must be 3 characters").default("USD"),
      billingInterval: billingIntervalSchema.optional().nullable(),
      stripeProductId: z.string().trim().optional().nullable(),
      stripePriceId: z.string().trim().optional().nullable(),
      isActive: z.boolean().default(true),
    })
    .superRefine((data, ctx) => {
      if (data.priceType === "SUBSCRIPTION" && !data.billingInterval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billingInterval"],
          message: "billingInterval is required for subscription prices",
        });
      }

      if (data.priceType === "ONE_TIME" && data.billingInterval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billingInterval"],
          message: "billingInterval must be empty for one-time prices",
        });
      }
    }),
});

export const updateCoursePriceSchema = z.object({
  params: z.object({
    priceId: z.string().min(1, "Price ID is required"),
  }),
  body: z.object({
    amount: z.coerce.number().positive().optional(),
    currency: z.string().trim().length(3).optional(),
    billingInterval: billingIntervalSchema.optional().nullable(),
    stripeProductId: z.string().trim().optional().nullable(),
    stripePriceId: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const priceIdParamSchema = z.object({
  params: z.object({
    priceId: z.string().min(1, "Price ID is required"),
  }),
});