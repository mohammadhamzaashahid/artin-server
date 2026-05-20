import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  courseIdParamSchema,
  createCoursePriceSchema,
  createCourseSchema,
  listAdminCoursesSchema,
  priceIdParamSchema,
  updateCoursePriceSchema,
  updateCourseSchema,
} from "./course.validation.js";
import {
  createCourseByAdmin,
  createCoursePriceByAdmin,
  deleteCourseByAdmin,
  deleteCoursePriceByAdmin,
  getCourseByAdmin,
  listCoursePricesByAdmin,
  listCoursesByAdmin,
  publishCourseByAdmin,
  unpublishCourseByAdmin,
  updateCourseByAdmin,
  updateCoursePriceByAdmin,
} from "./course.controller.js";

const router = Router();

router.post("/", validate(createCourseSchema), createCourseByAdmin);
router.get("/", validate(listAdminCoursesSchema), listCoursesByAdmin);

router.patch("/prices/:priceId", validate(updateCoursePriceSchema), updateCoursePriceByAdmin);
router.delete("/prices/:priceId", validate(priceIdParamSchema), deleteCoursePriceByAdmin);

router.get("/:courseId", validate(courseIdParamSchema), getCourseByAdmin);
router.patch("/:courseId", validate(updateCourseSchema), updateCourseByAdmin);
router.delete("/:courseId", validate(courseIdParamSchema), deleteCourseByAdmin);

router.patch("/:courseId/publish", validate(courseIdParamSchema), publishCourseByAdmin);
router.patch("/:courseId/unpublish", validate(courseIdParamSchema), unpublishCourseByAdmin);

router.post("/:courseId/prices", validate(createCoursePriceSchema), createCoursePriceByAdmin);
router.get("/:courseId/prices", validate(courseIdParamSchema), listCoursePricesByAdmin);

export default router;