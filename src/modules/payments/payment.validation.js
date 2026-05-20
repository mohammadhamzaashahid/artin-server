import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, "courseId is required"),
    coursePriceId: z.string().min(1, "coursePriceId is required"),
  }),
});

export const createCustomerPortalSessionSchema = z.object({
  body: z.object({}).optional(),
});

export const listMyPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});