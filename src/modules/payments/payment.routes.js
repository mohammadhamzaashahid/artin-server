import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createCheckoutSessionSchema,
  createCustomerPortalSessionSchema,
  getSessionStatusSchema,
  listMyPaymentsSchema,
} from "./payment.validation.js";

import {
  createCheckoutSessionController,
  createCustomerPortalSessionController,
  getSessionStatusController,
  listMyCoursesController,
  listMyPurchasesController,
  listMySubscriptionsController,
} from "./payment.controller.js";

const router = Router();

router.use(authenticate);
router.use(requireVerifiedEmail);

router.post(
  "/create-checkout-session",
  validate(createCheckoutSessionSchema),
  createCheckoutSessionController
);

router.post(
  "/create-customer-portal-session",
  validate(createCustomerPortalSessionSchema),
  createCustomerPortalSessionController
);

router.get("/session-status", validate(getSessionStatusSchema), getSessionStatusController);
router.get("/my-purchases", validate(listMyPaymentsSchema), listMyPurchasesController);
router.get("/my-subscriptions", validate(listMyPaymentsSchema), listMySubscriptionsController);
router.get("/my-courses", validate(listMyPaymentsSchema), listMyCoursesController);

export default router;