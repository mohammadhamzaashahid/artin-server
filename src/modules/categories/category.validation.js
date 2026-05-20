import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Category name must be at least 2 characters").max(100),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen-separated")
      .optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    categoryId: z.string().min(1, "Category ID is required"),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen-separated")
      .optional(),
  }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({
    categoryId: z.string().min(1, "Category ID is required"),
  }),
});

export const listCategoriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().trim().optional(),
  }),
});