import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";

import { getBookPublic, listBooksPublic } from "./book.controller.js";
import {
  bookSlugParamSchema,
  listPublicBooksSchema,
} from "./book.validation.js";

import { getBookAudioPlayback } from "./book-audio.controller.js";
import { audioFilePlaybackParamsSchema } from "./book-audio.validation.js";

import {
  placeBookOrderByUser,
  listMyBookOrdersByUser,
  getMyBookOrderByUser,
} from "../book-orders/book-order.controller.js";

import {
  listMyBookOrdersSchema,
  orderIdParamSchema,
  placeBookOrderSchema,
} from "../book-orders/book-order.validation.js";

const router = Router();

// ─── Public: book listing & detail ───────────────────────────────────────────

// More specific paths must be registered before /:slug to avoid conflicts.

router.get("/", validate(listPublicBooksSchema), listBooksPublic);

// User order history (requires auth) — must come before /:slug
router.get("/orders/my", authenticate, validate(listMyBookOrdersSchema), listMyBookOrdersByUser);
router.get("/orders/my/:orderId", authenticate, validate(orderIdParamSchema), getMyBookOrderByUser);

// Audio playback — optionalAuth: free-preview tracks work without login
router.get(
  "/:bookId/audio-files/:audioFileId/playback",
  optionalAuthenticate,
  validate(audioFilePlaybackParamsSchema),
  getBookAudioPlayback
);

// Place order (requires auth)
router.post("/:bookId/orders", authenticate, validate(placeBookOrderSchema), placeBookOrderByUser);

// Book detail — keep last so /:slug doesn't swallow the above paths
router.get("/:slug", optionalAuthenticate, validate(bookSlugParamSchema), getBookPublic);

export default router;
