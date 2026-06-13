import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import { handleMediaUpload } from "./media.multer.js";
import {
  listMediaAssetsSchema,
  mediaAssetIdParamSchema,
  uploadMediaSchema,
} from "./media.validation.js";

import {
  deleteMediaAssetByAdmin,
  getMediaAssetByAdmin,
  getMediaAssetPreviewUrlByAdmin,
  listMediaAssetsByAdmin,
  uploadMediaByAdmin,
} from "./media.controller.js";

const router = Router();

// multer runs first (writes temp file), then validate checks the body fields
router.post("/upload", handleMediaUpload, validate(uploadMediaSchema), uploadMediaByAdmin);

router.get("/", validate(listMediaAssetsSchema), listMediaAssetsByAdmin);
router.get("/:mediaAssetId/preview-url", validate(mediaAssetIdParamSchema), getMediaAssetPreviewUrlByAdmin);
router.get("/:mediaAssetId", validate(mediaAssetIdParamSchema), getMediaAssetByAdmin);
router.delete("/:mediaAssetId", validate(mediaAssetIdParamSchema), deleteMediaAssetByAdmin);

export default router;
