import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";

import {
  addCoverImageByAdmin,
  createBookByAdmin,
  deleteBookByAdmin,
  getBookByAdmin,
  listBooksByAdmin,
  listCoverImagesByAdmin,
  publishBookByAdmin,
  reorderCoverImagesByAdmin,
  removeCoverImageByAdmin,
  unpublishBookByAdmin,
  updateBookByAdmin,
} from "./book.controller.js";

import {
  addCoverImageSchema,
  bookIdParamSchema,
  coverImageIdParamSchema,
  createBookSchema,
  listAdminBooksSchema,
  reorderCoverImagesSchema,
  updateBookSchema,
} from "./book.validation.js";

import {
  createBookAudioFileByAdmin,
  deleteBookAudioFileByAdmin,
  getBookAudioFileByAdmin,
  listBookAudioFilesByAdmin,
  reorderBookAudioFilesByAdmin,
  updateBookAudioFileByAdmin,
} from "./book-audio.controller.js";

import {
  bookAudioParamsSchema,
  createBookAudioFileSchema,
  listBookAudioFilesSchema,
  reorderBookAudioFilesSchema,
  updateBookAudioFileSchema,
} from "./book-audio.validation.js";

const router = Router();

// ─── Books ────────────────────────────────────────────────────────────────────

router.post("/", validate(createBookSchema), createBookByAdmin);
router.get("/", validate(listAdminBooksSchema), listBooksByAdmin);
router.get("/:bookId", validate(bookIdParamSchema), getBookByAdmin);
router.patch("/:bookId", validate(updateBookSchema), updateBookByAdmin);
router.post("/:bookId/publish", validate(bookIdParamSchema), publishBookByAdmin);
router.post("/:bookId/unpublish", validate(bookIdParamSchema), unpublishBookByAdmin);
router.delete("/:bookId", validate(bookIdParamSchema), deleteBookByAdmin);

// ─── Cover images ─────────────────────────────────────────────────────────────

router.post("/:bookId/cover-images", validate(addCoverImageSchema), addCoverImageByAdmin);
router.get("/:bookId/cover-images", validate(bookIdParamSchema), listCoverImagesByAdmin);
router.post(
  "/:bookId/cover-images/reorder",
  validate(reorderCoverImagesSchema),
  reorderCoverImagesByAdmin
);
router.delete(
  "/:bookId/cover-images/:coverImageId",
  validate(coverImageIdParamSchema),
  removeCoverImageByAdmin
);

// ─── Audio files ──────────────────────────────────────────────────────────────

router.post(
  "/:bookId/audio-files",
  validate(createBookAudioFileSchema),
  createBookAudioFileByAdmin
);
router.get(
  "/:bookId/audio-files",
  validate(listBookAudioFilesSchema),
  listBookAudioFilesByAdmin
);
router.post(
  "/:bookId/audio-files/reorder",
  validate(reorderBookAudioFilesSchema),
  reorderBookAudioFilesByAdmin
);
router.get(
  "/:bookId/audio-files/:audioFileId",
  validate(bookAudioParamsSchema),
  getBookAudioFileByAdmin
);
router.patch(
  "/:bookId/audio-files/:audioFileId",
  validate(updateBookAudioFileSchema),
  updateBookAudioFileByAdmin
);
router.delete(
  "/:bookId/audio-files/:audioFileId",
  validate(bookAudioParamsSchema),
  deleteBookAudioFileByAdmin
);

export default router;
