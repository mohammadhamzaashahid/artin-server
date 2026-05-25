import { Router } from "express";

import { optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { courseSlugParamSchema, listPublicCoursesSchema } from "./course.validation.js";
import { getCoursePublic, listCoursesPublic } from "./course.controller.js";
import {
  mediaAssetIdParamSchema,
  publicCourseImagePreviewParamSchema,
} from "../media/media.validation.js";
import {
  getPublicCourseImagePreviewByCourseController,
  getPublicCourseImagePreviewUrlController,
} from "../media/media.controller.js";

const router = Router();

router.get("/", validate(listPublicCoursesSchema), listCoursesPublic);
router.get(
  "/media/:mediaAssetId/preview-url",
  validate(mediaAssetIdParamSchema),
  getPublicCourseImagePreviewUrlController
);
router.get(
  "/:slug/images/:imageType/preview-url",
  validate(publicCourseImagePreviewParamSchema),
  getPublicCourseImagePreviewByCourseController
);
router.get("/:slug", optionalAuthenticate, validate(courseSlugParamSchema), getCoursePublic);

export default router;
