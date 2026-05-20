import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { ensureStripeConfigured, getStripeClient } from "../../config/stripe.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  getCourseAccessForUser,
} from "../access/access.service.js";

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

const toStripeAmount = (amount) => {
  return Math.round(Number(amount) * 100);
};

const getOrCreateStripeCustomer = async (user) => {
  const stripe = getStripeClient();

  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);

      if (!customer.deleted) {
        return customer.id;
      }
    } catch {
     
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: {
      userId: user.id,
    },
  });

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
    : await stripe.products.create({
        name: course.title,
        description: course.shortDescription || course.subtitle || course.title,
        metadata: {
          courseId: course.id,
        },
      });

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

  const price = await stripe.prices.create(pricePayload);

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

  const checkoutSession = await stripe.checkout.sessions.create({
    mode,
    customer: stripeCustomerId,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: env.STRIPE_SUCCESS_URL,
    cancel_url: env.STRIPE_CANCEL_URL,
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
  });

  if (coursePrice.priceType === "ONE_TIME") {
    await prisma.purchase.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      create: {
        userId: user.id,
        courseId: course.id,
        coursePriceId: coursePrice.id,
        amount: coursePrice.amount,
        currency: coursePrice.currency,
        status: "PENDING",
        stripeCheckoutSessionId: checkoutSession.id,
      },
      update: {
        coursePriceId: coursePrice.id,
        amount: coursePrice.amount,
        currency: coursePrice.currency,
        status: "PENDING",
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentIntentId: null,
        purchasedAt: null,
        refundedAt: null,
      },
    });
  }

  if (coursePrice.priceType === "SUBSCRIPTION") {
    await prisma.courseSubscription.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      create: {
        userId: user.id,
        courseId: course.id,
        coursePriceId: coursePrice.id,
        stripeCustomerId,
        stripeCheckoutSessionId: checkoutSession.id,
        status: "INCOMPLETE",
      },
      update: {
        coursePriceId: coursePrice.id,
        stripeCustomerId,
        stripeCheckoutSessionId: checkoutSession.id,
        status: "INCOMPLETE",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
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
    items,
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
    items,
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
    items,
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const processCheckoutSessionCompleted = async (session) => {
  const metadata = session.metadata || {};
  const userId = metadata.userId;
  const courseId = metadata.courseId;
  const coursePriceId = metadata.coursePriceId;

  if (!userId || !courseId || !coursePriceId) {
    throw new Error("Missing checkout session metadata");
  }

  if (session.mode === "payment") {
    const paymentIntentId = getStripeId(session.payment_intent);

    await prisma.purchase.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
      },
      data: {
        status: "PAID",
        stripePaymentIntentId: paymentIntentId,
        purchasedAt: new Date(),
      },
    });

    return;
  }

  if (session.mode === "subscription") {
    const stripeSubscriptionId = getStripeId(session.subscription);

    if (!stripeSubscriptionId) {
      throw new Error("Missing Stripe subscription ID");
    }

    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    await processStripeSubscriptionObject(subscription);
  }
};

export const processCheckoutSessionExpired = async (session) => {
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
  if (session.mode === "payment") {
    await prisma.purchase.updateMany({
      where: {
        stripeCheckoutSessionId: session.id,
      },
      data: {
        status: "FAILED",
      },
    });
  }
};

export const processStripeSubscriptionObject = async (subscription) => {
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