import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Valid email is required")
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must not exceed 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(40, "Username must not exceed 40 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscore")
      .optional(),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(80, "First name must not exceed 80 characters"),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(80, "Last name must not exceed 80 characters"),
    password: passwordSchema,
  }),
});

export const verifyEmailOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: z
      .string()
      .trim()
      .length(6, "OTP must be 6 digits")
      .regex(/^[0-9]+$/, "OTP must contain digits only"),
  }),
});

export const resendEmailOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    emailOrUsername: z.string().trim().min(1, "Email or username is required"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: z
      .string()
      .trim()
      .length(6, "OTP must be 6 digits")
      .regex(/^[0-9]+$/, "OTP must contain digits only"),
    newPassword: passwordSchema,
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({}).optional(),
});

export const logoutSchema = z.object({
  body: z.object({}).optional(),
});