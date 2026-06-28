import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createCheckoutSessionSchema,
  createCustomerPortalSessionSchema,
  createLiveClassCheckoutSessionSchema,
  getSessionStatusSchema,
  listMyPaymentsSchema,
} from "./payment.validation.js";

import {
  createCheckoutSessionController,
  createCustomerPortalSessionController,
  createLiveClassCheckoutSessionController,
  getMyAccessibleLiveClassesController,
  getMyLiveClassPurchasesController,
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

router.post(
  "/live-classes/create-checkout-session",
  validate(createLiveClassCheckoutSessionSchema),
  createLiveClassCheckoutSessionController
);
router.get(
  "/live-classes/my-purchases",
  validate(listMyPaymentsSchema),
  getMyLiveClassPurchasesController
);
router.get(
  "/live-classes/my-classes",
  validate(listMyPaymentsSchema),
  getMyAccessibleLiveClassesController
);

export default router;