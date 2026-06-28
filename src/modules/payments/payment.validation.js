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

export const getSessionStatusSchema = z.object({
  query: z.object({
    sessionId: z.string().trim().min(1, "sessionId is required"),
  }),
});

export const createLiveClassCheckoutSessionSchema = z.object({
  body: z.object({
    liveClassId: z.string().min(1, "liveClassId is required"),
    liveClassPriceId: z.string().min(1, "liveClassPriceId is required"),
  }),
});