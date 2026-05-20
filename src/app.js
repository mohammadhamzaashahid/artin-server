import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { globalRateLimiter } from "./middlewares/rateLimit.middleware.js";

import authRoutes from "./modules/auth/auth.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";

import categoryPublicRoutes from "./modules/categories/category.public.routes.js";
import tagPublicRoutes from "./modules/tags/tag.public.routes.js";
import coursePublicRoutes from "./modules/courses/course.public.routes.js";
import mediaUserRoutes from "./modules/media/media.user.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import stripeWebhookRoutes from "./modules/payments/stripeWebhook.routes.js";

const app = express();

app.set("json replacer", (_key, value) =>
  typeof value === "bigint" ? value.toString() : value
);

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(globalRateLimiter);

app.use("/api/webhooks", stripeWebhookRoutes);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/categories", categoryPublicRoutes);
app.use("/api/tags", tagPublicRoutes);
app.use("/api/courses", coursePublicRoutes);
app.use("/api/lectures", mediaUserRoutes);
app.use("/api/payments", paymentRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
