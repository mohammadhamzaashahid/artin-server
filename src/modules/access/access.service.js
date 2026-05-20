import { prisma } from "../../config/prisma.js";

export const ACTIVE_SUBSCRIPTION_STATUSES = Object.freeze(["ACTIVE", "TRIALING"]);

export const hasActiveCoursePurchase = async ({ userId, courseId }) => {
  if (!userId || !courseId) return false;

  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      courseId,
      status: "PAID",
    },
    select: {
      id: true,
    },
  });

  return Boolean(purchase);
};

export const hasActiveCourseSubscription = async ({ userId, courseId }) => {
  if (!userId || !courseId) return false;

  const subscription = await prisma.courseSubscription.findFirst({
    where: {
      userId,
      courseId,
      status: {
        in: ACTIVE_SUBSCRIPTION_STATUSES,
      },
      OR: [
        {
          currentPeriodEnd: null,
        },
        {
          currentPeriodEnd: {
            gt: new Date(),
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return Boolean(subscription);
};

export const getCourseAccessForUser = async ({ userId, courseId }) => {
  if (!userId || !courseId) {
    return {
      hasAccess: false,
      accessType: "NONE",
      reason: "AUTH_REQUIRED",
    };
  }

  const [hasPurchase, hasSubscription] = await Promise.all([
    hasActiveCoursePurchase({ userId, courseId }),
    hasActiveCourseSubscription({ userId, courseId }),
  ]);

  if (hasSubscription) {
    return {
      hasAccess: true,
      accessType: "SUBSCRIPTION",
      reason: "ACTIVE_SUBSCRIPTION",
    };
  }

  if (hasPurchase) {
    return {
      hasAccess: true,
      accessType: "PURCHASE",
      reason: "ACTIVE_PURCHASE",
    };
  }

  return {
    hasAccess: false,
    accessType: "NONE",
    reason: "PAYMENT_REQUIRED",
  };
};

export const buildLectureAccessView = ({ lecture, courseAccess }) => {
  const isPreviewFree = Boolean(lecture.isPreviewFree);
  const hasCourseAccess = Boolean(courseAccess?.hasAccess);

  const isLocked = !isPreviewFree && !hasCourseAccess;

  return {
    ...lecture,
    isLocked,
    canPlay: !isLocked,
    lockReason: isLocked ? courseAccess?.reason || "PAYMENT_REQUIRED" : null,
  };
};