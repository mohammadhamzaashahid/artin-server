import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  createLiveClassSchema,
  createLiveClassPriceSchema,
  liveClassIdParamSchema,
  liveClassPriceIdParamSchema,
  listAdminLiveClassesSchema,
  updateLiveClassSchema,
  updateLiveClassPriceSchema,
} from "./liveClass.validation.js";
import {
  createLiveClassByAdmin,
  createLiveClassPriceByAdmin,
  deleteLiveClassByAdmin,
  deleteLiveClassPriceByAdmin,
  getLiveClassByAdmin,
  listLiveClassesByAdmin,
  listLiveClassPricesByAdmin,
  publishLiveClassByAdmin,
  unpublishLiveClassByAdmin,
  updateLiveClassByAdmin,
  updateLiveClassPriceByAdmin,
} from "./liveClass.controller.js";

const router = Router();

router.post("/", validate(createLiveClassSchema), createLiveClassByAdmin);
router.get("/", validate(listAdminLiveClassesSchema), listLiveClassesByAdmin);

router.patch("/prices/:priceId", validate(updateLiveClassPriceSchema), updateLiveClassPriceByAdmin);
router.delete(
  "/prices/:priceId",
  validate(liveClassPriceIdParamSchema),
  deleteLiveClassPriceByAdmin
);

router.get("/:liveClassId", validate(liveClassIdParamSchema), getLiveClassByAdmin);
router.patch("/:liveClassId", validate(updateLiveClassSchema), updateLiveClassByAdmin);
router.delete("/:liveClassId", validate(liveClassIdParamSchema), deleteLiveClassByAdmin);

router.patch(
  "/:liveClassId/publish",
  validate(liveClassIdParamSchema),
  publishLiveClassByAdmin
);
router.patch(
  "/:liveClassId/unpublish",
  validate(liveClassIdParamSchema),
  unpublishLiveClassByAdmin
);

router.post(
  "/:liveClassId/prices",
  validate(createLiveClassPriceSchema),
  createLiveClassPriceByAdmin
);
router.get(
  "/:liveClassId/prices",
  validate(liveClassIdParamSchema),
  listLiveClassPricesByAdmin
);

export default router;
