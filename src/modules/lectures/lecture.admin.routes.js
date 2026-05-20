
import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  createLectureSchema,
  lectureIdParamSchema,
  listLecturesByCourseSchema,
  reorderLecturesSchema,
  updateLectureSchema,
} from "./lecture.validation.js";

import {
  createLectureByAdmin,
  deleteLectureByAdmin,
  getLectureByAdmin,
  listLecturesByCourseAdmin,
  reorderLecturesByAdmin,
  updateLectureByAdmin,
} from "./lecture.controller.js";

const router = Router();

router.post("/courses/:courseId/lectures", validate(createLectureSchema), createLectureByAdmin);
router.get("/courses/:courseId/lectures", validate(listLecturesByCourseSchema), listLecturesByCourseAdmin);
router.patch("/courses/:courseId/lectures/reorder", validate(reorderLecturesSchema), reorderLecturesByAdmin);

router.get("/lectures/:lectureId", validate(lectureIdParamSchema), getLectureByAdmin);
router.patch("/lectures/:lectureId", validate(updateLectureSchema), updateLectureByAdmin);
router.delete("/lectures/:lectureId", validate(lectureIdParamSchema), deleteLectureByAdmin);

export default router;