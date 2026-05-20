import { Router } from "express";

import { optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { courseSlugParamSchema, listPublicCoursesSchema } from "./course.validation.js";
import { getCoursePublic, listCoursesPublic } from "./course.controller.js";

const router = Router();

router.get("/", validate(listPublicCoursesSchema), listCoursesPublic);
router.get("/:slug", optionalAuthenticate, validate(courseSlugParamSchema), getCoursePublic);

export default router;