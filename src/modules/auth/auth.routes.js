import { Router } from "express";

import {
  changePasswordController,
  forgotPassword,
  login,
  logout,
  me,
  refreshToken,
  register,
  resendOtp,
  resetPasswordController,
  verifyOtp,
} from "./auth.controller.js";

import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  authRateLimiter,
  otpRateLimiter,
  passwordResetRateLimiter,
} from "../../middlewares/rateLimit.middleware.js";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resendEmailOtpSchema,
  resetPasswordSchema,
  verifyEmailOtpSchema,
} from "./auth.validation.js";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), register);
router.post("/verify-email-otp", otpRateLimiter, validate(verifyEmailOtpSchema), verifyOtp);
router.post("/resend-email-otp", otpRateLimiter, validate(resendEmailOtpSchema), resendOtp);

router.post("/login", authRateLimiter, validate(loginSchema), login);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", validate(logoutSchema), logout);

router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

router.post(
  "/reset-password",
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  resetPasswordController
);

router.post(
  "/change-password",
  authenticate,
  authRateLimiter,
  validate(changePasswordSchema),
  changePasswordController
);

router.get("/me", authenticate, me);

export default router;