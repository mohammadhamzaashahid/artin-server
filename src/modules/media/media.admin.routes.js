import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  completeUploadSchema,
  createUploadUrlSchema,
  listMediaAssetsSchema,
  mediaAssetIdParamSchema,
} from "./media.validation.js";

import {
  completeUploadByAdmin,
  createUploadUrlByAdmin,
  deleteMediaAssetByAdmin,
  getMediaAssetByAdmin,
  getMediaAssetPreviewUrlByAdmin,
  listMediaAssetsByAdmin,
} from "./media.controller.js";

const router = Router();

router.post("/create-upload-url", validate(createUploadUrlSchema), createUploadUrlByAdmin);
router.post("/complete-upload", validate(completeUploadSchema), completeUploadByAdmin);
router.get("/", validate(listMediaAssetsSchema), listMediaAssetsByAdmin);
router.get("/:mediaAssetId/preview-url", validate(mediaAssetIdParamSchema), getMediaAssetPreviewUrlByAdmin);
router.get("/:mediaAssetId", validate(mediaAssetIdParamSchema), getMediaAssetByAdmin);
router.delete("/:mediaAssetId", validate(mediaAssetIdParamSchema), deleteMediaAssetByAdmin);

export default router;
