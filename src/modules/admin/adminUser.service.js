import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { hashPassword } from "../../utils/crypto.js";
import { generateTemporaryPassword } from "../../utils/password.js";
import { sendEmail } from "../emails/email.service.js";
import { buildAdminCreatedTemplate } from "../emails/email.templates.js";

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

const normalizeEmail = (email) => email.trim().toLowerCase();

const normalizeUsername = (username) => {
  if (username === null) return null;
  if (!username) return undefined;
  return username.trim().toLowerCase();
};

const buildUserWhere = ({ search, role, isActive }) => {
  const where = {};

  if (role) {
    where.role = role;
  }

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search) {
    const q = search.trim();

    where.OR = [
      {
        email: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        username: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        firstName: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        lastName: {
          contains: q,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
};

export const adminCreateUser = async ({
  email,
  username,
  firstName,
  lastName,
  password,
  role,
  emailVerified,
  isActive,
  sendWelcomeEmail,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = username ? username.trim().toLowerCase() : null;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedEmail },
        ...(normalizedUsername ? [{ username: normalizedUsername }] : []),
      ],
    },
    select: {
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

  const finalPassword = password || generateTemporaryPassword();
  const passwordHash = await hashPassword(finalPassword);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: normalizedUsername,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash,
      role,
      emailVerifiedAt: emailVerified ? new Date() : null,
      isActive,
    },
    select: userSafeSelect,
  });

  if (sendWelcomeEmail) {
    const template = buildAdminCreatedTemplate({
      firstName: user.firstName,
      email: user.email,
      temporaryPassword: finalPassword,
    });

    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  return {
    user,
    temporaryPassword: sendWelcomeEmail ? undefined : finalPassword,
  };
};

export const adminListUsers = async ({ page, limit, search, role, isActive }) => {
  const skip = (page - 1) * limit;
  const where = buildUserWhere({ search, role, isActive });

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        ...userSafeSelect,
        _count: {
          select: {
            purchases: true,
            subscriptions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const adminGetUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      ...userSafeSelect,
      purchases: {
        select: {
          id: true,
          courseId: true,
          status: true,
          amount: true,
          currency: true,
          purchasedAt: true,
          createdAt: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      subscriptions: {
        select: {
          id: true,
          courseId: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          canceledAt: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

export const adminUpdateUser = async ({
  actorUserId,
  targetUserId,
  username,
  firstName,
  lastName,
  role,
  isActive,
  emailVerified,
}) => {
  if (actorUserId === targetUserId && isActive === false) {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: targetUserId,
    },
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  const data = {};

  if (typeof username !== "undefined") {
    const normalizedUsername = normalizeUsername(username);

    if (normalizedUsername) {
      const usernameExists = await prisma.user.findFirst({
        where: {
          username: normalizedUsername,
          NOT: {
            id: targetUserId,
          },
        },
        select: {
          id: true,
        },
      });

      if (usernameExists) {
        throw new ApiError(409, "Username is already taken");
      }

      data.username = normalizedUsername;
    } else {
      data.username = null;
    }
  }

  if (typeof firstName !== "undefined") data.firstName = firstName.trim();
  if (typeof lastName !== "undefined") data.lastName = lastName.trim();
  if (typeof role !== "undefined") data.role = role;
  if (typeof isActive !== "undefined") data.isActive = isActive;

  if (typeof emailVerified !== "undefined") {
    data.emailVerifiedAt = emailVerified ? existingUser.emailVerifiedAt || new Date() : null;
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data,
    select: userSafeSelect,
  });

  if (isActive === false) {
    await prisma.refreshToken.updateMany({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  return updatedUser;
};

export const adminResetUserPassword = async ({
  targetUserId,
  newPassword,
  sendEmail: shouldSendEmail,
}) => {
  const user = await prisma.user.findUnique({
    where: {
      id: targetUserId,
    },
    select: userSafeSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const finalPassword = newPassword || generateTemporaryPassword();
  const passwordHash = await hashPassword(finalPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: targetUserId,
      },
      data: {
        passwordHash,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });

  if (shouldSendEmail) {
    const template = buildAdminCreatedTemplate({
      firstName: user.firstName,
      email: user.email,
      temporaryPassword: finalPassword,
    });

    await sendEmail({
      to: user.email,
      subject: "Your password has been reset",
      html: template.html,
      text: template.text,
    });
  }

  return {
    reset: true,
    temporaryPassword: shouldSendEmail ? undefined : finalPassword,
  };
};

export const adminDeleteUser = async ({ actorUserId, targetUserId }) => {
  if (actorUserId === targetUserId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: targetUserId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  /*
    We do not hard-delete users because users are tied to payments,
    subscriptions, progress, and audit history.
  */
  const updatedUser = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      isActive: false,
    },
    select: userSafeSelect,
  });

  await prisma.refreshToken.updateMany({
    where: {
      userId: targetUserId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return updatedUser;
};