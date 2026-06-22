import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLIENT_URL: z.string().url("CLIENT_URL must be a valid URL"),

  JWT_ACCESS_SECRET: z.string().min(30, "JWT_ACCESS_SECRET must be strong"),
  JWT_REFRESH_SECRET: z.string().min(30, "JWT_REFRESH_SECRET must be strong"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),

  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  EMAIL_FROM_NAME: z.string().min(1).default("Course Platform"),
  EMAIL_FROM_EMAIL: z.string().email().default("noreply@example.com"),
  SUPPORT_EMAIL: z.string().email().default("support@example.com"),

  RESEND_API_KEY: z.string().optional().default(""),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),

  OTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  OTP_RATE_LIMIT_MAX: z.coerce.number().default(5),

  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  PASSWORD_RESET_RATE_LIMIT_MAX: z.coerce.number().default(5),

  UPLOADS_DIR: z.string().optional().default(""),
  SERVER_BASE_URL: z.string().url().default("http://localhost:5000"),

  ADMIN_ORDER_EMAIL: z.string().email().optional().default(""),

  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_SUCCESS_URL: z
    .string()
    .url()
    .optional()
    // .default("http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}"),
    .default("https://artinistitute-lms.vercel.app/payment/success?session_id={CHECKOUT_SESSION_ID}"),
  STRIPE_CANCEL_URL: z
    .string()
    .url()
    .optional()
    .default("https://artinistitute-lms.vercel.app/payment/cancel"),
  STRIPE_CUSTOMER_PORTAL_RETURN_URL: z
    .string()
    .url()
    .optional()
    .default("https://artinistitute-lms.vercel.app/profile/billing"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
  process.exit(1);
}

if (env.EMAIL_PROVIDER === "smtp") {
  const missing = [];

  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_USER) missing.push("SMTP_USER");
  if (!env.SMTP_PASS) missing.push("SMTP_PASS");

  if (missing.length > 0) {
    console.error(`Missing SMTP environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const isStripeConfigured =
  env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY && env.STRIPE_WEBHOOK_SECRET;

if (env.NODE_ENV !== "test" && !isStripeConfigured) {
  console.warn(
    "Stripe is not fully configured. Payment APIs/webhooks will fail until Stripe env values are set."
  );
}

export { env };