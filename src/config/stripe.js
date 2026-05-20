import Stripe from "stripe";
import { env } from "./env.js";

let stripeClient = null;

export const getStripeClient = () => {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};

export const ensureStripeConfigured = () => {
  const missing = [];

  if (!env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (!env.STRIPE_PUBLISHABLE_KEY) missing.push("STRIPE_PUBLISHABLE_KEY");
  if (!env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");

  if (missing.length > 0) {
    throw new Error(`Stripe is not configured. Missing: ${missing.join(", ")}`);
  }
};