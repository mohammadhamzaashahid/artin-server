import { z } from "zod";
import { passwordSchema } from "../auth/auth.validation.js";

const userRoleSchema = z.enum(["USER", "ADMIN", "SUPER_ADMIN"]);

export const adminCreateUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email("Valid email is required").toLowerCase(),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(40, "Username must not exceed 40 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscore")
      .optional(),
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    password: passwordSchema.optional(),
    role: userRoleSchema.default("USER"),
    emailVerified: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sendWelcomeEmail: z.boolean().default(true),
  }),
});

export const adminListUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    role: userRoleSchema.optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => {
        if (value === "true") return true;
        if (value === "false") return false;
        return undefined;
      }),
  }),
});

export const adminUserIdParamSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
});

export const adminUpdateUserSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  body: z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[a-zA-Z0-9_]+$/)
      .nullable()
      .optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
  }),
});

export const adminResetUserPasswordSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
  body: z.object({
    newPassword: passwordSchema.optional(),
    sendEmail: z.boolean().default(true),
  }),
});