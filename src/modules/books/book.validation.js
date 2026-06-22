import { z } from "zod";

const bookStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const createBookSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, "Book title is required").max(180),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(220)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen-separated")
      .optional(),
    description: z.string().trim().max(10000).optional().nullable(),
    price: z.coerce.number().nonnegative("Price must be zero or greater").default(0),
    currency: z.string().trim().length(3, "Currency must be 3 characters").default("USD"),
  }),
});

export const updateBookSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
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
    price: z.coerce.number().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    status: bookStatusSchema.optional(),
  }),
});

export const bookIdParamSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
});

export const listAdminBooksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    status: bookStatusSchema.optional(),
    includeDeleted: z.enum(["true", "false"]).default("false"),
  }),
});

export const listPublicBooksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12),
    search: z.string().trim().optional(),
  }),
});

export const bookSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Book slug is required"),
  }),
});

export const addCoverImageSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
  body: z.object({
    mediaAssetId: z.string().min(1, "Media asset ID is required"),
    displayOrder: z.coerce.number().int().nonnegative().default(0),
  }),
});

export const reorderCoverImagesSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          coverImageId: z.string().min(1),
          displayOrder: z.number().int().nonnegative(),
        })
      )
      .min(1, "At least one item is required"),
  }),
});

export const coverImageIdParamSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
    coverImageId: z.string().min(1, "Cover image ID is required"),
  }),
});
