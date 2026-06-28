import { Router } from "express";

import { optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  liveClassSlugParamSchema,
  listPublicLiveClassesSchema,
} from "./liveClass.validation.js";
import { getLiveClassPublic, listLiveClassesPublic } from "./liveClass.controller.js";

const router = Router();

router.get("/", validate(listPublicLiveClassesSchema), listLiveClassesPublic);
router.get("/:slug", optionalAuthenticate, validate(liveClassSlugParamSchema), getLiveClassPublic);

export default router;
