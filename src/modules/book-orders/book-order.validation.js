import { z } from "zod";

const bookOrderStatusSchema = z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]);

export const placeBookOrderSchema = z.object({
  params: z.object({
    bookId: z.string().min(1, "Book ID is required"),
  }),
  body: z.object({
    quantity: z.coerce
      .number()
      .int()
      .positive("Quantity must be at least 1")
      .max(10, "Maximum 10 copies per order")
      .default(1),
    deliveryName: z.string().trim().min(2, "Delivery name is required").max(120),
    deliveryEmail: z.string().trim().email("A valid email is required"),
    deliveryPhone: z.string().trim().min(7, "Phone number is required").max(20),
    deliveryAddress: z.string().trim().min(5, "Delivery address is required").max(500),
    deliveryCity: z.string().trim().min(2, "City is required").max(100),
    deliveryState: z.string().trim().max(100).optional().nullable(),
    deliveryPostalCode: z.string().trim().max(20).optional().nullable(),
    deliveryCountry: z.string().trim().min(2, "Country is required").max(100).default("Pakistan"),
    deliveryNotes: z.string().trim().max(500).optional().nullable(),
  }),
});

export const updateBookOrderStatusSchema = z.object({
  params: z.object({
    orderId: z.string().min(1, "Order ID is required"),
  }),
  body: z.object({
    status: bookOrderStatusSchema,
    adminNotes: z.string().trim().max(1000).optional().nullable(),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    orderId: z.string().min(1, "Order ID is required"),
  }),
});

export const listAdminBookOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: bookOrderStatusSchema.optional(),
    search: z.string().trim().optional(),
    bookId: z.string().optional(),
  }),
});

export const listMyBookOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    status: bookOrderStatusSchema.optional(),
  }),
});
