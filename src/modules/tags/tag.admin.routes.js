import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  createTagSchema,
  listTagsSchema,
  tagIdParamSchema,
  updateTagSchema,
} from "./tag.validation.js";
import {
  createTagByAdmin,
  deleteTagByAdmin,
  getTagByAdmin,
  listTagsByAdmin,
  updateTagByAdmin,
} from "./tag.controller.js";

const router = Router();

router.post("/", validate(createTagSchema), createTagByAdmin);
router.get("/", validate(listTagsSchema), listTagsByAdmin);
router.get("/:tagId", validate(tagIdParamSchema), getTagByAdmin);
router.patch("/:tagId", validate(updateTagSchema), updateTagByAdmin);
router.delete("/:tagId", validate(tagIdParamSchema), deleteTagByAdmin);

export default router;