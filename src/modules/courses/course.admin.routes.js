import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  batchIdParamSchema,
  courseIdParamSchema,
  createCourseBatchSchema,
  createCoursePriceSchema,
  createCourseSchema,
  listAdminCoursesSchema,
  priceIdParamSchema,
  updateCourseBatchSchema,
  updateCoursePriceSchema,
  updateCourseSchema,
} from "./course.validation.js";
import {
  createCourseByAdmin,
  createCourseBatchByAdmin,
  createCoursePriceByAdmin,
  deleteCourseByAdmin,
  deleteCourseBatchByAdmin,
  deleteCoursePriceByAdmin,
  getCourseByAdmin,
  listCourseBatchesByAdmin,
  listCoursePricesByAdmin,
  listCoursesByAdmin,
  publishCourseByAdmin,
  unpublishCourseByAdmin,
  updateCourseByAdmin,
  updateCourseBatchByAdmin,
  updateCoursePriceByAdmin,
} from "./course.controller.js";

const router = Router();

router.post("/", validate(createCourseSchema), createCourseByAdmin);
router.get("/", validate(listAdminCoursesSchema), listCoursesByAdmin);

router.patch("/prices/:priceId", validate(updateCoursePriceSchema), updateCoursePriceByAdmin);
router.delete("/prices/:priceId", validate(priceIdParamSchema), deleteCoursePriceByAdmin);

router.patch("/batches/:batchId", validate(updateCourseBatchSchema), updateCourseBatchByAdmin);
router.delete("/batches/:batchId", validate(batchIdParamSchema), deleteCourseBatchByAdmin);

router.get("/:courseId", validate(courseIdParamSchema), getCourseByAdmin);
router.patch("/:courseId", validate(updateCourseSchema), updateCourseByAdmin);
router.delete("/:courseId", validate(courseIdParamSchema), deleteCourseByAdmin);

router.patch("/:courseId/publish", validate(courseIdParamSchema), publishCourseByAdmin);
router.patch("/:courseId/unpublish", validate(courseIdParamSchema), unpublishCourseByAdmin);

router.post("/:courseId/prices", validate(createCoursePriceSchema), createCoursePriceByAdmin);
router.get("/:courseId/prices", validate(courseIdParamSchema), listCoursePricesByAdmin);

router.post("/:courseId/batches", validate(createCourseBatchSchema), createCourseBatchByAdmin);
router.get("/:courseId/batches", validate(courseIdParamSchema), listCourseBatchesByAdmin);

export default router;