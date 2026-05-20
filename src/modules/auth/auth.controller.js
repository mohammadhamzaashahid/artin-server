import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import {
  changePassword,
  getAuthCookieOptions,
  getClearCookieOptions,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshUserToken,
  registerUser,
  requestPasswordReset,
  resendEmailOtp,
  resetPassword,
  verifyEmailOtp,
} from "./auth.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";

const sendAuthResponse = (res, statusCode, data, message) => {
  res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, getAuthCookieOptions());

  return res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      {
        user: data.user,
        accessToken: data.accessToken,
      },
      message
    )
  );
};

export const register = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await registerUser(body);

  const responseData = {
    user: result.user,
  };

  if (process.env.NODE_ENV === "development") {
    responseData.devOtp = result.otp;
  }

  return res
    .status(201)
    .json(new ApiResponse(201, responseData, "Registration successful. Please verify your email"));
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await verifyEmailOtp(body);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Email verified successfully"));
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await resendEmailOtp(body);

  const responseData = {
    user: result.user,
  };

  if (process.env.NODE_ENV === "development") {
    responseData.devOtp = result.otp;
  }

  return res.status(200).json(new ApiResponse(200, responseData, "OTP resent successfully"));
});

export const login = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await loginUser(body);

  return sendAuthResponse(res, 200, result, "Login successful");
});

export const refreshToken = asyncHandler(async (req, res) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];

  const result = await refreshUserToken({
    refreshToken: tokenFromCookie,
  });

  return sendAuthResponse(res, 200, result, "Token refreshed successfully");
});

export const logout = asyncHandler(async (req, res) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];

  await logoutUser({
    refreshToken: tokenFromCookie,
  });

  res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

  return res.status(200).json(new ApiResponse(200, null, "Logout successful"));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await requestPasswordReset(body);

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "If the email exists, a password reset OTP has been sent"
    )
  );
});

export const resetPasswordController = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await resetPassword(body);

  res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

  return res.status(200).json(new ApiResponse(200, result, "Password reset successfully"));
});

export const changePasswordController = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await changePassword({
    userId: req.user.id,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  });

  res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Password changed successfully. Please login again"
    )
  );
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  return res.status(200).json(new ApiResponse(200, { user }, "Current user fetched successfully"));
});