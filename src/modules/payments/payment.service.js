import { createHash } from "crypto";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { ensureStripeConfigured, getStripeClient } from "../../config/stripe.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  getCourseAccessForUser,
  getLiveClassAccessForUser,
} from "../access/access.service.js";
import { formatMediaAssetForResponse } from "../media/media.service.js";

const stripeSubscriptionStatusToDb = (status) => {
  const map = {
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    paused: "PAUSED",
  };

  return map[status] || "INCOMPLETE";
};

const toDateFromUnixSeconds = (value) => {
  if (!value) return null;
  return new Date(value * 1000);
};

const getStripeId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
};

const isUniqueConstraintError = (error) => error?.code === "P2002";

const toStripeAmount = (amount) => {
  return Math.round(Number(amount) * 100);
};

const appendUrlParams = (url, params) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && typeof value !== "undefined") {
      searchParams.set(key, value);
    }
  });

  if (!searchParams.toString()) return url;

  const separator = url.includes("?")
    ? url.endsWith("?") || url.endsWith("&")
      ? ""
      : "&"
    : "?";

  return `${url}${separator}${searchParams.toString()}`;
};

const buildStripeIdempotencyKey = (prefix, parts) => {
  const hash = createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32);
  return `${prefix}:${hash}`;
};

const getCheckoutIdempotencyKey = ({ userId, courseId, coursePriceId }) => {
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return buildStripeIdempotencyKey("checkout", [userId, courseId, coursePriceId, dayBucket]);
};

const formatCourseSummaryForResponse = (course) => {
  if (!course) return course;

  return {
    ...course,
    thumbnailImageAsset: formatMediaAssetForResponse(course.thumbnailImageAsset),
  };
};

const formatCourseRelationItemForResponse = (item) => {
  return {
    ...item,
    course: formatCourseSummaryForResponse(item.course),
  };
};

const getOrCreateStripeCustomer = async (user) => {
  const stripe = getStripeClient();

  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);

      if (!customer.deleted) {
        return customer.id;
      }
    } catch {}
  }

  const customer = await stripe.customers.create(
    {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      metadata: {
        userId: user.id,
      },
    },
    {
      idempotencyKey: buildStripeIdempotencyKey("customer", [user.id]),
    }
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
};

const getOrCreateStripePriceForCoursePrice = async ({ course, coursePrice }) => {
  const stripe = getStripeClient();

  if (coursePrice.stripeProductId && coursePrice.stripePriceId) {
    return {
      stripeProductId: coursePrice.stripeProductId,
      stripePriceId: coursePrice.stripePriceId,
    };
  }

  const product = coursePrice.stripeProductId
    ? await stripe.products.retrieve(coursePrice.stripeProductId)
    : await stripe.products.create(
        {
          name: course.title,
          description: course.shortDescription || course.subtitle || course.title,
          metadata: {
            courseId: course.id,
          },
        },
        {
          idempotencyKey: buildStripeIdempotencyKey("course-product", [course.id]),
        }
      );

  const pricePayload = {
    product: product.id,
    unit_amount: toStripeAmount(coursePrice.amount),
    currency: coursePrice.currency.toLowerCase(),
    metadata: {
      courseId: course.id,
      coursePriceId: coursePrice.id,
      priceType: coursePrice.priceType,
    },
  };

  if (coursePrice.priceType === "SUBSCRIPTION") {
    if (!coursePrice.billingInterval) {
      throw new ApiError(400, "Subscription price must have billing interval");
    }

    pricePayload.recurring = {
      interval: coursePrice.billingInterval.toLowerCase(),
    };
  }

  const price = await stripe.prices.create(pricePayload, {
    idempotencyKey: buildStripeIdempotencyKey("course-price", [coursePrice.id]),
  });

  await prisma.coursePrice.update({
    where: {
      id: coursePrice.id,
    },
    data: {
      stripeProductId: product.id,
      stripePriceId: price.id,
    },
  });

  return {
    stripeProductId: product.id,
    stripePriceId: price.id,
  };
};

const getCourseAndPriceForCheckout = async ({ courseId, coursePriceId }) => {
  const course = await prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      prices: {
        where: {
          id: coursePriceId,
          isActive: true,
        },
      },
    },
  });

  if (!course || course.deletedAt || course.status !== "PUBLISHED") {
    throw new ApiError(404, "Course not found or not available");
  }

  const coursePrice = course.prices[0];

  if (!coursePrice) {
    throw new ApiError(404, "Course price not found or inactive");
  }

  return {
    course,
    coursePrice,
  };
};

const upsertPendingPurchaseForCheckout = async ({
  userId,
  courseId,
  coursePrice,
  stripeCheckoutSessionId,
}) => {
  const pendingData = {
    coursePriceId: coursePrice.id,
    amount: coursePrice.amount,
    currency: coursePrice.currency,
    status: "PENDING",
    stripeCheckoutSessionId,
    stripePaymentIntentId: null,
    purchasedAt: null,
    refundedAt: null,
  };

  const updateResult = await prisma.purchase.updateMany({
    where: {
      userId,
      courseId,
      status: {
        not: "PAID",
      },
    },
    data: pendingData,
  });

  if (updateResult.count > 0) return;

  const existingPaidPurchase = await prisma.purchase.findFirst({
    where: {
      userId,
      courseId,
      status: "PAID",
    },
    select: {
      id: true,
    },
  });

  if (existingPaidPurchase) return;

  try {
    await prisma.purchase.create({
      data: {
        userId,
        courseId,
        ...pendingData,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    await prisma.purchase.updateMany({
      where: {
        userId,
        courseId,
        status: {
          not: "PAID",
        },
      },
      data: pendingData,
    });
  }
};

const upsertPendingSubscriptionForCheckout = async ({
  userId,
  courseId,
  coursePriceId,
  stripeCustomerId,
  stripeCheckoutSessionId,
}) => {
  const pendingData = {
    coursePriceId,
    stripeCustomerId,
    stripeCheckoutSessionId,
    status: "INCOMPLETE",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
  };

  const updateResult = await prisma.courseSubscription.updateMany({
    where: {
      userId,
      courseId,
      status: {
        notIn: ACTIVE_SUBSCRIPTION_STATUSES,
      },
    },
    data: pendingData,
  });

  if (updateResult.count > 0) return;

  const activeSubscription = await prisma.courseSubscription.findFirst({
    where: {
      userId,
      courseId,
      status: {
        in: ACTIVE_SUBSCRIPTION_STATUSES,
      },
    },
    select: {
      id: true,
      stripeCheckoutSessionId: true,
    },
  });

  if (activeSubscription) {
    if (!activeSubscription.stripeCheckoutSessionId) {
      await prisma.courseSubscription.update({
        where: {
          id: activeSubscription.id,
        },
        data: {
          stripeCheckoutSessionId,
        },
      });
    }

    return;
  }

  try {
    await prisma.courseSubscription.create({
      data: {
        userId,
        courseId,
        ...pendingData,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    await prisma.courseSubscription.updateMany({
      where: {
        userId,
        courseId,
        status: {
          notIn: ACTIVE_SUBSCRIPTION_STATUSES,
        },
      },
      data: pendingData,
    });
  }
};

const getReusableCheckoutSession = async ({ userId, courseId, priceType }) => {
  const localCheckout =
    priceType === "ONE_TIME"
      ? await prisma.purchase.findFirst({
          where: {
            userId,
            courseId,
            status: "PENDING",
            stripeCheckoutSessionId: {
              not: null,
            },
          },
          select: {
            stripeCheckoutSessionId: true,
          },
        })
      : await prisma.courseSubscription.findFirst({
          where: {
            userId,
            courseId,
            status: "INCOMPLETE",
            stripeCheckoutSessionId: {
              not: null,
            },
          },
          select: {
            stripeCheckoutSessionId: true,
          },
        });

  if (!localCheckout?.stripeCheckoutSessionId) return null;

  const stripe = getStripeClient();
  let session;

  try {
    session = await stripe.checkout.sessions.retrieve(localCheckout.stripeCheckoutSessionId);
  } catch {
    return null;
  }

  if (session.status === "open" && session.url) {
    return {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      mode: session.mode,
      reused: true,
    };
  }

  if (session.status === "expired") {
    await processCheckoutSessionExpired(session);
    return null;
  }

  if (
    (session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid") ||
    (session.mode === "subscription" && session.status === "complete")
  ) {
    await processCheckoutSessionCompleted(session);
    return {
      completed: true,
    };
  }

  return null;
};

const markPurchasePaidFromCheckoutSession = async (session) => {
  const metadata = session.metadata || {};
  const userId = metadata.userId;
  const courseId = metadata.courseId;
  const coursePriceId = metadata.coursePriceId;
  const paymentIntentId = getStripeId(session.payment_intent);

  const existingPaidPurchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    select: {
      id: true,
      status: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
    },
  });

  if (existingPaidPurchase?.status === "PAID") {
    const isSamePayment =
      existingPaidPurchase.stripeCheckoutSessionId === session.id ||
      existingPaidPurchase.stripePaymentIntentId === paymentIntentId;

    if (isSamePayment || !paymentIntentId) return;

    const stripe = getStripeClient();

    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: {
          reason: "duplicate_course_purchase",
          originalPurchaseId: existingPaidPurchase.id,
          duplicateCheckoutSessionId: session.id,
        },
      },
      {
        idempotencyKey: buildStripeIdempotencyKey("duplicate-refund", [paymentIntentId]),
      }
    );

    return;
  }

  const coursePrice = await prisma.coursePrice.findUnique({
    where: {
      id: coursePriceId,
    },
    select: {
      id: true,
      amount: true,
      currency: true,
    },
  });

  const amountTotal =
    typeof session.amount_total === "number" ? session.amount_total / 100 : null;

  const paidData = {
    coursePriceId,
    amount: coursePrice?.amount ?? amountTotal ?? 0,
    currency: (coursePrice?.currency || session.currency || "USD").toUpperCase(),
    status: "PAID",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    purchasedAt: new Date(),
    refundedAt: null,
  };

  try {
    await prisma.purchase.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      create: {
        userId,
        courseId,
        ...paidData,
      },
      update: paidData,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    await prisma.purchase.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
      },
      data: paidData,
    });
  }
};

export const createCheckoutSession = async ({ userId, courseId, coursePriceId }) => {
  ensureStripeConfigured();

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      emailVerifiedAt: true,
      isActive: true,
      stripeCustomerId: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, "User not found or inactive");
  }

  if (!user.emailVerifiedAt) {
    throw new ApiError(403, "Please verify your email before purchasing");
  }

  const { course, coursePrice } = await getCourseAndPriceForCheckout({
    courseId,
    coursePriceId,
  });

  const existingAccess = await getCourseAccessForUser({
    userId: user.id,
    courseId: course.id,
  });

  if (existingAccess.hasAccess) {
    throw new ApiError(400, "You already have access to this course");
  }

  const reusableSession = await getReusableCheckoutSession({
    userId: user.id,
    courseId: course.id,
    priceType: coursePrice.priceType,
  });

  if (reusableSession?.checkoutUrl) {
    return reusableSession;
  }

  if (reusableSession?.completed) {
    const refreshedAccess = await getCourseAccessForUser({
      userId: user.id,
      courseId: course.id,
    });

    if (refreshedAccess.hasAccess) {
      throw new ApiError(400, "You already have access to this course");
    }
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(user);

  const { stripePriceId } = await getOrCreateStripePriceForCoursePrice({
    course,
    coursePrice,
  });

  const stripe = getStripeClient();

  const mode = coursePrice.priceType === "SUBSCRIPTION" ? "subscription" : "payment";

  const metadata = {
    userId: user.id,
    courseId: course.id,
    coursePriceId: coursePrice.id,
    priceType: coursePrice.priceType,
  };

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode,
      customer: stripeCustomerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: appendUrlParams(env.STRIPE_SUCCESS_URL, { slug: course.slug }),
      cancel_url: appendUrlParams(env.STRIPE_CANCEL_URL, { slug: course.slug }),
      client_reference_id: `${user.id}:${course.id}:${coursePrice.id}`,
      metadata,
      ...(mode === "subscription"
        ? {
            subscription_data: {
              metadata,
            },
          }
        : {
            payment_intent_data: {
              metadata,
            },
          }),
    },
    {
      idempotencyKey: getCheckoutIdempotencyKey({
        userId: user.id,
        courseId: course.id,
        coursePriceId: coursePrice.id,
      }),
    }
  );

  if (coursePrice.priceType === "ONE_TIME") {
    await upsertPendingPurchaseForCheckout({
      userId: user.id,
      courseId: course.id,
      coursePrice,
      stripeCheckoutSessionId: checkoutSession.id,
    });
  }

  if (coursePrice.priceType === "SUBSCRIPTION") {
    await upsertPendingSubscriptionForCheckout({
      userId: user.id,
      courseId: course.id,
      coursePriceId: coursePrice.id,
      stripeCustomerId,
      stripeCheckoutSessionId: checkoutSession.id,
    });
  }

  return {
    checkoutSessionId: checkoutSession.id,
    checkoutUrl: checkoutSession.url,
    mode,
  };
};

export const createCustomerPortalSession = async ({ userId }) => {
  ensureStripeConfigured();

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.stripeCustomerId) {
    throw new ApiError(400, "Stripe customer does not exist yet");
  }

  const stripe = getStripeClient();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: env.STRIPE_CUSTOMER_PORTAL_RETURN_URL,
  });

  return {
    url: portalSession.url,
  };
};

export const listMyPurchases = async ({ userId, page, limit }) => {
  const pagination = getPagination({ page, limit });

  const [items, total] = await prisma.$transaction([
    prisma.purchase.findMany({
      where: {
        userId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            shortDescription: true,
            thumbnailImageAsset: {
              select: {
                id: true,
                provider: true,
                objectKey: true,
                publicUrl: true,
              },
            },
          },
        },
        coursePrice: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.purchase.count({
      where: {
        userId,
      },
    }),
  ]);

  return {
    items: items.map(formatCourseRelationItemForResponse),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const listMySubscriptions = async ({ userId, page, limit }) => {
  const pagination = getPagination({ page, limit });

  const [items, total] = await prisma.$transaction([
    prisma.courseSubscription.findMany({
      where: {
        userId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            shortDescription: true,
            thumbnailImageAsset: {
              select: {
                id: true,
                provider: true,
                objectKey: true,
                publicUrl: true,
              },
            },
          },
        },
        coursePrice: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.courseSubscription.count({
      where: {
        userId,
      },
    }),
  ]);

  return {
    items: items.map(formatCourseRelationItemForResponse),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getMyAccessibleCourses = async ({ userId, page, limit }) => {
  const pagination = getPagination({ page, limit });
  const now = new Date();

  const where = {
    status: "PUBLISHED",
    deletedAt: null,
    OR: [
      {
        purchases: {
          some: {
            userId,
            status: "PAID",
          },
        },
      },
      {
        subscriptions: {
          some: {
            userId,
            status: {
              in: ACTIVE_SUBSCRIPTION_STATUSES,
            },
            OR: [
              {
                currentPeriodEnd: null,
              },
              {
                currentPeriodEnd: {
                  gt: now,
                },
              },
            ],
          },
        },
      },
    ],
  };

  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        category: true,
        thumbnailImageAsset: {
          select: {
            id: true,
            provider: true,
            objectKey: true,
            publicUrl: true,
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    items: items.map(formatCourseSummaryForResponse),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getCheckoutSessionStatus = async ({ userId, sessionId }) => {
  const findLocalSessionStatus = async () => {
    const purchase = await prisma.purchase.findFirst({
      where: {
        userId,
        stripeCheckoutSessionId: sessionId,
      },
      select: {
        status: true,
        course: {
          select: { slug: true },
        },
      },
    });

    if (purchase) {
      return {
        status: purchase.status,
        type: "PURCHASE",
        courseSlug: purchase.course?.slug || null,
        entityType: "COURSE",
      };
    }

    const subscription = await prisma.courseSubscription.findFirst({
      where: {
        userId,
        stripeCheckoutSessionId: sessionId,
      },
      select: {
        status: true,
        course: {
          select: { slug: true },
        },
      },
    });

    if (subscription) {
      return {
        status: subscription.status,
        type: "SUBSCRIPTION",
        courseSlug: subscription.course?.slug || null,
        entityType: "COURSE",
      };
    }

    const liveClassPurchase = await prisma.liveClassPurchase.findFirst({
      where: {
        userId,
        stripeCheckoutSessionId: sessionId,
      },
      select: {
        status: true,
        liveClass: {
          select: { slug: true },
        },
      },
    });

    if (liveClassPurchase) {
      return {
        status: liveClassPurchase.status,
        type: "PURCHASE",
        liveClassSlug: liveClassPurchase.liveClass?.slug || null,
        entityType: "LIVE_CLASS",
      };
    }

    return null;
  };

  const localStatus = await findLocalSessionStatus();

  if (
    localStatus &&
    ["PAID", "ACTIVE", "TRIALING", "FAILED", "CANCELLED", "INCOMPLETE_EXPIRED"].includes(
      localStatus.status
    )
  ) {
    return localStatus;
  }

  ensureStripeConfigured();

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      stripeCustomerId: true,
    },
  });

  const stripe = getStripeClient();
  let session;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "subscription"],
    });
  } catch {
    return (
      localStatus || {
        status: "NOT_FOUND",
        type: null,
        courseSlug: null,
      }
    );
  }

  const sessionUserId = session.metadata?.userId || null;
  const sessionCustomerId = getStripeId(session.customer);
  const belongsToUser =
    sessionUserId === userId ||
    (user?.stripeCustomerId && sessionCustomerId === user.stripeCustomerId);

  if (!belongsToUser) {
    return (
      localStatus || {
        status: "NOT_FOUND",
        type: null,
        courseSlug: null,
      }
    );
  }

  if (session.status === "expired") {
    await processCheckoutSessionExpired(session);
  } else if (
    session.mode === "payment" &&
    session.status === "complete" &&
    session.payment_status === "paid"
  ) {
    await processCheckoutSessionCompleted(session);
  } else if (session.mode === "subscription" && session.status === "complete") {
    await processCheckoutSessionCompleted(session);
  }

  return (
    (await findLocalSessionStatus()) || {
      status: "NOT_FOUND",
      type: null,
      courseSlug: null,
    }
  );
};

const markLiveClassPurchasePaidFromCheckoutSession = async (session) => {
  const metadata = session.metadata || {};
  const userId = metadata.userId;
  const liveClassId = metadata.liveClassId;
  const liveClassPriceId = metadata.liveClassPriceId;
  const paymentIntentId = getStripeId(session.payment_intent);

  const existingPaidPurchase = await prisma.liveClassPurchase.findUnique({
    where: { userId_liveClassId: { userId, liveClassId } },
    select: {
      id: true,
      status: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
    },
  });

  if (existingPaidPurchase?.status === "PAID") {
    const isSamePayment =
      existingPaidPurchase.stripeCheckoutSessionId === session.id ||
      existingPaidPurchase.stripePaymentIntentId === paymentIntentId;

    if (isSamePayment || !paymentIntentId) return;

    const stripe = getStripeClient();

    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        metadata: {
          reason: "duplicate_live_class_purchase",
          originalPurchaseId: existingPaidPurchase.id,
          duplicateCheckoutSessionId: session.id,
        },
      },
      {
        idempotencyKey: buildStripeIdempotencyKey("lc-duplicate-refund", [paymentIntentId]),
      }
    );

    return;
  }

  const liveClassPrice = await prisma.liveClassPrice.findUnique({
    where: { id: liveClassPriceId },
    select: { id: true, amount: true, currency: true },
  });

  const amountTotal =
    typeof session.amount_total === "number" ? session.amount_total / 100 : null;

  const paidData = {
    liveClassPriceId,
    amount: liveClassPrice?.amount ?? amountTotal ?? 0,
    currency: (liveClassPrice?.currency || session.currency || "USD").toUpperCase(),
    status: "PAID",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    purchasedAt: new Date(),
    refundedAt: null,
  };

  try {
    await prisma.liveClassPurchase.upsert({
      where: { userId_liveClassId: { userId, liveClassId } },
      create: { userId, liveClassId, ...paidData },
      update: paidData,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    await prisma.liveClassPurchase.updateMany({
      where: { stripeCheckoutSessionId: session.id },
      data: paidData,
    });
  }
};

export const processCheckoutSessionCompleted = async (session) => {
  const metadata = session.metadata || {};
  const entityType = metadata.entityType || "COURSE";

  if (entityType === "LIVE_CLASS") {
    if (session.mode === "payment") {
      if (session.payment_status && session.payment_status !== "paid") {
        return;
      }

      await markLiveClassPurchasePaidFromCheckoutSession(session);
    }

    return;
  }

  const userId = metadata.userId;
  const courseId = metadata.courseId;
  const coursePriceId = metadata.coursePriceId;

  if (!userId || !courseId || !coursePriceId) {
    throw new Error("Missing checkout session metadata");
  }

  if (session.mode === "payment") {
    if (session.payment_status && session.payment_status !== "paid") {
      return;
    }

    await markPurchasePaidFromCheckoutSession(session);

    return;
  }

  if (session.mode === "subscription") {
    const stripeSubscriptionId = getStripeId(session.subscription);

    if (!stripeSubscriptionId) {
      throw new Error("Missing Stripe subscription ID");
    }

    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    await processStripeSubscriptionObject(subscription, {
      stripeCheckoutSessionId: session.id,
    });
  }
};

export const processCheckoutSessionExpired = async (session) => {
  const entityType = session.metadata?.entityType || "COURSE";

  if (entityType === "LIVE_CLASS") {
    if (session.mode === "payment") {
      await prisma.liveClassPurchase.updateMany({
        where: { stripeCheckoutSessionId: session.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }

    return;
  }

  if (session.mode === "payment") {
    await prisma.purchase.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });
  }

  if (session.mode === "subscription") {
    await prisma.courseSubscription.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
        status: "INCOMPLETE",
      },
      data: {
        status: "INCOMPLETE_EXPIRED",
      },
    });
  }
};

export const processCheckoutSessionPaymentFailed = async (session) => {
  const entityType = session.metadata?.entityType || "COURSE";

  if (entityType === "LIVE_CLASS") {
    if (session.mode === "payment") {
      await prisma.liveClassPurchase.updateMany({
        where: { stripeCheckoutSessionId: session.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    return;
  }

  if (session.mode === "payment") {
    await prisma.purchase.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });
  }
};

export const processStripeSubscriptionObject = async (subscription, options = {}) => {
  const metadata = subscription.metadata || {};
  const userId = metadata.userId;
  const courseId = metadata.courseId;
  const coursePriceId = metadata.coursePriceId || null;

  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = getStripeId(subscription.customer);

  const data = {
    stripeSubscriptionId,
    stripeCustomerId,
    status: stripeSubscriptionStatusToDb(subscription.status),
    currentPeriodStart: toDateFromUnixSeconds(subscription.current_period_start),
    currentPeriodEnd: toDateFromUnixSeconds(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    canceledAt: toDateFromUnixSeconds(subscription.canceled_at),
    ...(options.stripeCheckoutSessionId
      ? { stripeCheckoutSessionId: options.stripeCheckoutSessionId }
      : {}),
  };

  const existingBySubscriptionId = await prisma.courseSubscription.findFirst({
    where: {
      stripeSubscriptionId,
    },
  });

  if (existingBySubscriptionId) {
    await prisma.courseSubscription.update({
      where: {
        id: existingBySubscriptionId.id,
      },
      data,
    });

    return;
  }

  if (userId && courseId) {
    await prisma.courseSubscription.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      create: {
        userId,
        courseId,
        coursePriceId,
        ...data,
      },
      update: {
        coursePriceId,
        ...data,
      },
    });
  }
};

export const saveAndProcessStripeEvent = async (event) => {
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: {
      stripeEventId: event.id,
    },
  });

  if (existingEvent?.processedAt) {
    return {
      duplicate: true,
      processed: true,
    };
  }

  await prisma.paymentEvent.upsert({
    where: {
      stripeEventId: event.id,
    },
    create: {
      stripeEventId: event.id,
      eventType: event.type,
      payloadJson: event,
    },
    update: {
      eventType: event.type,
      payloadJson: event,
    },
  });

  switch (event.type) {
    case "checkout.session.completed":
      await processCheckoutSessionCompleted(event.data.object);
      break;

    case "checkout.session.expired":
      await processCheckoutSessionExpired(event.data.object);
      break;

    case "checkout.session.async_payment_failed":
      await processCheckoutSessionPaymentFailed(event.data.object);
      break;

    case "checkout.session.async_payment_succeeded":
      await processCheckoutSessionCompleted(event.data.object);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await processStripeSubscriptionObject(event.data.object);
      break;

    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      if (event.data.object.subscription) {
        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
        await processStripeSubscriptionObject(subscription);
      }
      break;

    default:
      break;
  }

  await prisma.paymentEvent.update({
    where: {
      stripeEventId: event.id,
    },
    data: {
      processedAt: new Date(),
    },
  });

  return {
    duplicate: false,
    processed: true,
  };
};

// ─── Live Class Payments ──────────────────────────────────────────────────────

const getOrCreateStripePriceForLiveClassPrice = async ({ liveClass, liveClassPrice }) => {
  const stripe = getStripeClient();

  if (liveClassPrice.stripeProductId && liveClassPrice.stripePriceId) {
    return {
      stripeProductId: liveClassPrice.stripeProductId,
      stripePriceId: liveClassPrice.stripePriceId,
    };
  }

  const product = liveClassPrice.stripeProductId
    ? await stripe.products.retrieve(liveClassPrice.stripeProductId)
    : await stripe.products.create(
        {
          name: liveClass.title,
          description: liveClass.description || liveClass.title,
          metadata: { liveClassId: liveClass.id },
        },
        {
          idempotencyKey: buildStripeIdempotencyKey("lc-product", [liveClass.id]),
        }
      );

  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: toStripeAmount(liveClassPrice.amount),
      currency: liveClassPrice.currency.toLowerCase(),
      metadata: {
        liveClassId: liveClass.id,
        liveClassPriceId: liveClassPrice.id,
      },
    },
    {
      idempotencyKey: buildStripeIdempotencyKey("lc-price", [liveClassPrice.id]),
    }
  );

  await prisma.liveClassPrice.update({
    where: { id: liveClassPrice.id },
    data: {
      stripeProductId: product.id,
      stripePriceId: price.id,
    },
  });

  return {
    stripeProductId: product.id,
    stripePriceId: price.id,
  };
};

const upsertPendingLiveClassPurchaseForCheckout = async ({
  userId,
  liveClassId,
  liveClassPrice,
  stripeCheckoutSessionId,
}) => {
  const pendingData = {
    liveClassPriceId: liveClassPrice.id,
    amount: liveClassPrice.amount,
    currency: liveClassPrice.currency,
    status: "PENDING",
    stripeCheckoutSessionId,
    stripePaymentIntentId: null,
    purchasedAt: null,
    refundedAt: null,
  };

  const updateResult = await prisma.liveClassPurchase.updateMany({
    where: {
      userId,
      liveClassId,
      status: { not: "PAID" },
    },
    data: pendingData,
  });

  if (updateResult.count > 0) return;

  const paidPurchase = await prisma.liveClassPurchase.findFirst({
    where: { userId, liveClassId, status: "PAID" },
    select: { id: true },
  });

  if (paidPurchase) return;

  try {
    await prisma.liveClassPurchase.create({
      data: { userId, liveClassId, ...pendingData },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    await prisma.liveClassPurchase.updateMany({
      where: { userId, liveClassId, status: { not: "PAID" } },
      data: pendingData,
    });
  }
};

export const createLiveClassCheckoutSession = async ({
  userId,
  liveClassId,
  liveClassPriceId,
}) => {
  ensureStripeConfigured();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      emailVerifiedAt: true,
      isActive: true,
      stripeCustomerId: true,
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, "User not found or inactive");
  }

  if (!user.emailVerifiedAt) {
    throw new ApiError(403, "Please verify your email before purchasing");
  }

  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    include: {
      prices: {
        where: { id: liveClassPriceId, isActive: true },
      },
    },
  });

  if (!liveClass || liveClass.deletedAt || liveClass.status !== "PUBLISHED") {
    throw new ApiError(404, "Live class not found or not available");
  }

  const liveClassPrice = liveClass.prices[0];

  if (!liveClassPrice) {
    throw new ApiError(404, "Live class price not found or inactive");
  }

  const existingAccess = await getLiveClassAccessForUser({ userId: user.id, liveClassId });

  if (existingAccess.hasAccess) {
    throw new ApiError(400, "You already have access to this live class");
  }

  const pendingPurchase = await prisma.liveClassPurchase.findFirst({
    where: {
      userId: user.id,
      liveClassId,
      status: "PENDING",
      stripeCheckoutSessionId: { not: null },
    },
    select: { stripeCheckoutSessionId: true },
  });

  if (pendingPurchase?.stripeCheckoutSessionId) {
    const stripe = getStripeClient();

    try {
      const existingSession = await stripe.checkout.sessions.retrieve(
        pendingPurchase.stripeCheckoutSessionId
      );

      if (existingSession.status === "open" && existingSession.url) {
        return {
          checkoutSessionId: existingSession.id,
          checkoutUrl: existingSession.url,
          mode: "payment",
          reused: true,
        };
      }

      if (existingSession.status === "expired") {
        await processCheckoutSessionExpired(existingSession);
      }
    } catch {}
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(user);

  const { stripePriceId } = await getOrCreateStripePriceForLiveClassPrice({
    liveClass,
    liveClassPrice,
  });

  const stripe = getStripeClient();

  const metadata = {
    entityType: "LIVE_CLASS",
    userId: user.id,
    liveClassId,
    liveClassPriceId: liveClassPrice.id,
  };

  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const idempotencyKey = buildStripeIdempotencyKey("lc-checkout", [
    user.id,
    liveClassId,
    liveClassPrice.id,
    dayBucket,
  ]);

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: appendUrlParams(env.STRIPE_SUCCESS_URL, {
        slug: liveClass.slug,
        entityType: "live-class",
      }),
      cancel_url: appendUrlParams(env.STRIPE_CANCEL_URL, {
        slug: liveClass.slug,
        entityType: "live-class",
      }),
      client_reference_id: `${user.id}:${liveClassId}:${liveClassPrice.id}`,
      metadata,
      payment_intent_data: { metadata },
    },
    { idempotencyKey }
  );

  await upsertPendingLiveClassPurchaseForCheckout({
    userId: user.id,
    liveClassId,
    liveClassPrice,
    stripeCheckoutSessionId: checkoutSession.id,
  });

  return {
    checkoutSessionId: checkoutSession.id,
    checkoutUrl: checkoutSession.url,
    mode: "payment",
  };
};

export const getMyLiveClassPurchases = async ({ userId, page, limit }) => {
  const pagination = getPagination({ page, limit });

  const [items, total] = await prisma.$transaction([
    prisma.liveClassPurchase.findMany({
      where: { userId },
      include: {
        liveClass: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            startDate: true,
            endDate: true,
            timeDuration: true,
            bannerImageAsset: {
              select: { id: true, provider: true, objectKey: true, publicUrl: true },
            },
          },
        },
        liveClassPrice: true,
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.liveClassPurchase.count({ where: { userId } }),
  ]);

  return {
    items,
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getMyAccessibleLiveClasses = async ({ userId, page, limit }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    status: "PUBLISHED",
    deletedAt: null,
    purchases: {
      some: {
        userId,
        status: "PAID",
      },
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.liveClass.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        startDate: true,
        endDate: true,
        timeDuration: true,
        joiningLink: true,
        bannerImageAsset: {
          select: { id: true, provider: true, objectKey: true, publicUrl: true },
        },
        course: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { startDate: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.liveClass.count({ where }),
  ]);

  return {
    items,
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};
