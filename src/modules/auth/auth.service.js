import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import ApiError from "../../utils/ApiError.js";
import {
  compareOtp,
  comparePassword,
  generateNumericOtp,
  hashOtp,
  hashPassword,
  hashToken,
} from "../../utils/crypto.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/token.js";
import { sendEmail } from "../emails/email.service.js";
import {
  buildEmailOtpTemplate,
  buildPasswordResetTemplate,
} from "../emails/email.templates.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const userSafeSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  role: true,
  emailVerifiedAt: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60 * 1000);
};

const addDays = (date, days) => {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

const normalizeUsername = (username) => {
  if (!username) return null;
  return username.trim().toLowerCase();
};

const normalizeEmail = (email) => {
  return email.trim().toLowerCase();
};

const createRefreshTokenForUser = async (userId, tx = prisma) => {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);

  await tx.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: addDays(new Date(), REFRESH_TOKEN_EXPIRY_DAYS),
    },
  });

  return refreshToken;
};

const createEmailOtp = async ({ userId, email, purpose }, tx = prisma) => {
  const otp = generateNumericOtp(6);

  await tx.emailOtp.create({
    data: {
      userId,
      email,
      otpHash: hashOtp(otp),
      purpose,
      expiresAt: addMinutes(new Date(), OTP_EXPIRY_MINUTES),
    },
  });

  return otp;
};

const sendOtpEmail = async ({ user, otp, purpose }) => {
  const template =
    purpose === "PASSWORD_RESET"
      ? buildPasswordResetTemplate({
          firstName: user.firstName,
          otp,
        })
      : buildEmailOtpTemplate({
          firstName: user.firstName,
          otp,
        });

  await sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

const buildAuthResponse = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = await createRefreshTokenForUser(user.id);

  return {
    user,
    accessToken,
    refreshToken,
  };
};

export const registerUser = async ({ email, username, firstName, lastName, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        ...(normalizedUsername ? [{ username: normalizedUsername }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  if (existingUser?.email === normalizedEmail) {
    throw new ApiError(409, "Email is already registered");
  }

  if (normalizedUsername && existingUser?.username === normalizedUsername) {
    throw new ApiError(409, "Username is already taken");
  }

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        passwordHash,
      },
      select: userSafeSelect,
    });

    const otp = await createEmailOtp(
      {
        userId: user.id,
        email: normalizedEmail,
        purpose: "SIGNUP_VERIFY",
      },
      tx
    );

    return {
      user,
      otp,
    };
  });

  await sendOtpEmail({
    user: result.user,
    otp: result.otp,
    purpose: "SIGNUP_VERIFY",
  });

  return result;
};

export const verifyEmailOtp = async ({ email, otp }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: userSafeSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.emailVerifiedAt) {
    return {
      user,
      alreadyVerified: true,
    };
  }

  const latestOtp = await prisma.emailOtp.findFirst({
    where: {
      email: normalizedEmail,
      purpose: "SIGNUP_VERIFY",
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestOtp) {
    throw new ApiError(400, "OTP not found or already used");
  }

  if (latestOtp.expiresAt < new Date()) {
    throw new ApiError(400, "OTP has expired");
  }

  if (latestOtp.attempts >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(429, "Too many OTP attempts. Please request a new OTP");
  }

  const isValidOtp = compareOtp(otp, latestOtp.otpHash);

  if (!isValidOtp) {
    await prisma.emailOtp.update({
      where: {
        id: latestOtp.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new ApiError(400, "Invalid OTP");
  }

  const verifiedUser = await prisma.$transaction(async (tx) => {
    await tx.emailOtp.update({
      where: {
        id: latestOtp.id,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    return tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
      select: userSafeSelect,
    });
  });

  return {
    user: verifiedUser,
    alreadyVerified: false,
  };
};

export const resendEmailOtp = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: userSafeSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.emailVerifiedAt) {
    throw new ApiError(400, "Email is already verified");
  }

  const recentOtp = await prisma.emailOtp.findFirst({
    where: {
      email: normalizedEmail,
      purpose: "SIGNUP_VERIFY",
      consumedAt: null,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (recentOtp) {
    throw new ApiError(429, "Please wait before requesting another OTP");
  }

  const otp = await createEmailOtp({
    userId: user.id,
    email: normalizedEmail,
    purpose: "SIGNUP_VERIFY",
  });

  await sendOtpEmail({
    user,
    otp,
    purpose: "SIGNUP_VERIFY",
  });

  return {
    user,
    otp,
  };
};

export const loginUser = async ({ emailOrUsername, password }) => {
  const identifier = emailOrUsername.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Your account is inactive");
  }

  const isPasswordCorrect = await comparePassword(password, user.passwordHash);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid credentials");
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
    select: userSafeSelect,
  });

  return buildAuthResponse(updatedUser);
};

export const refreshUserToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  const tokenHash = hashToken(refreshToken);

  const savedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: userSafeSelect,
      },
    },
  });

  if (!savedToken || !savedToken.user) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (!savedToken.user.isActive) {
    throw new ApiError(403, "Your account is inactive");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: {
        id: savedToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const newRefreshToken = await createRefreshTokenForUser(savedToken.userId, tx);
    const accessToken = generateAccessToken(savedToken.user);

    return {
      user: savedToken.user,
      accessToken,
      refreshToken: newRefreshToken,
    };
  });

  return result;
};

export const logoutUser = async ({ refreshToken }) => {
  if (!refreshToken) {
    return {
      loggedOut: true,
    };
  }

  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return {
    loggedOut: true,
  };
};

export const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: userSafeSelect,
  });

  /*
    Security note:
    Do not reveal whether an email exists.
    But if user exists, send OTP.
  */
  if (!user || !user.isActive) {
    return {
      sent: true,
    };
  }

  const recentOtp = await prisma.emailOtp.findFirst({
    where: {
      email: normalizedEmail,
      purpose: "PASSWORD_RESET",
      consumedAt: null,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (recentOtp) {
    throw new ApiError(429, "Please wait before requesting another password reset OTP");
  }

  const otp = await createEmailOtp({
    userId: user.id,
    email: normalizedEmail,
    purpose: "PASSWORD_RESET",
  });

  await sendOtpEmail({
    user,
    otp,
    purpose: "PASSWORD_RESET",
  });

  return {
    sent: true,

  };
};

export const resetPassword = async ({ email, otp, newPassword }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      ...userSafeSelect,
      passwordHash: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(400, "Invalid or expired password reset request");
  }

  const latestOtp = await prisma.emailOtp.findFirst({
    where: {
      email: normalizedEmail,
      purpose: "PASSWORD_RESET",
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestOtp) {
    throw new ApiError(400, "Invalid or expired password reset request");
  }

  if (latestOtp.expiresAt < new Date()) {
    throw new ApiError(400, "Password reset OTP has expired");
  }

  if (latestOtp.attempts >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(429, "Too many OTP attempts. Please request a new OTP");
  }

  const isValidOtp = compareOtp(otp, latestOtp.otpHash);

  if (!isValidOtp) {
    await prisma.emailOtp.update({
      where: {
        id: latestOtp.id,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    throw new ApiError(400, "Invalid OTP");
  }

  const isSamePassword = await comparePassword(newPassword, user.passwordHash);

  if (isSamePassword) {
    throw new ApiError(400, "New password must be different from old password");
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.emailOtp.update({
      where: {
        id: latestOtp.id,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });

  return {
    reset: true,
  };
};

export const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);

  if (!isCurrentPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  const isSamePassword = await comparePassword(newPassword, user.passwordHash);

  if (isSamePassword) {
    throw new ApiError(400, "New password must be different from old password");
  }

  const newPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });

  return {
    changed: true,
  };
};

export const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: userSafeSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

export const getAuthCookieOptions = () => {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
};

export const getClearCookieOptions = () => {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };
};