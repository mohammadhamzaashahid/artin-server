import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const buildRateLimitResponse = (message) => ({
  success: false,
  message,
  errors: [],
});

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: buildRateLimitResponse("Too many requests. Please try again later"),
});

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: buildRateLimitResponse("Too many authentication attempts. Please try again later"),
});

export const otpRateLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MS,
  limit: env.OTP_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: buildRateLimitResponse("Too many OTP requests. Please try again later"),
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  limit: env.PASSWORD_RESET_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: buildRateLimitResponse("Too many password reset requests. Please try again later"),
});