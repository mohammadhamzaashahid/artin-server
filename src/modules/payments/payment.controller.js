import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { env } from "../../config/env.js";
import { getStripeClient } from "../../config/stripe.js";
import ApiError from "../../utils/ApiError.js";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getCheckoutSessionStatus,
  getMyAccessibleCourses,
  listMyPurchases,
  listMySubscriptions,
  saveAndProcessStripeEvent,
} from "./payment.service.js";

export const createCheckoutSessionController = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await createCheckoutSession({
    userId: req.user.id,
    courseId: body.courseId,
    coursePriceId: body.coursePriceId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, result, "Checkout session created successfully"));
});

export const createCustomerPortalSessionController = asyncHandler(async (req, res) => {
  const result = await createCustomerPortalSession({
    userId: req.user.id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, result, "Customer portal session created successfully"));
});

export const listMyPurchasesController = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listMyPurchases({
    userId: req.user.id,
    page: query.page,
    limit: query.limit,
  });

  return res.status(200).json(new ApiResponse(200, result, "Purchases fetched successfully"));
});

export const listMySubscriptionsController = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listMySubscriptions({
    userId: req.user.id,
    page: query.page,
    limit: query.limit,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Subscriptions fetched successfully"));
});

export const listMyCoursesController = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await getMyAccessibleCourses({
    userId: req.user.id,
    page: query.page,
    limit: query.limit,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Accessible courses fetched successfully"));
});

export const getSessionStatusController = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await getCheckoutSessionStatus({
    userId: req.user.id,
    sessionId: query.sessionId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Session status fetched successfully"));
});

export const stripeWebhookController = asyncHandler(async (req, res) => {
  const stripe = getStripeClient();
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    throw new ApiError(400, "Missing Stripe signature");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw new ApiError(400, `Stripe webhook signature verification failed: ${error.message}`);
  }

  const result = await saveAndProcessStripeEvent(event);

  return res.status(200).json({
    received: true,
    ...result,
  });
});