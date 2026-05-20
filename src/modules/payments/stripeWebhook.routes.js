import { Router } from "express";
import express from "express";

import { stripeWebhookController } from "./payment.controller.js";

const router = Router();

router.post("/stripe", express.raw({ type: "application/json" }), stripeWebhookController);

export default router;