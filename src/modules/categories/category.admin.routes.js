import { Router } from "express";

import { validate } from "../../middlewares/validate.middleware.js";
import {
  categoryIdParamSchema,
  createCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from "./category.validation.js";
import {
  createCategoryByAdmin,
  deleteCategoryByAdmin,
  getCategoryByAdmin,
  listCategoriesByAdmin,
  updateCategoryByAdmin,
} from "./category.controller.js";

const router = Router();

router.post("/", validate(createCategorySchema), createCategoryByAdmin);
router.get("/", validate(listCategoriesSchema), listCategoriesByAdmin);
router.get("/:categoryId", validate(categoryIdParamSchema), getCategoryByAdmin);
router.patch("/:categoryId", validate(updateCategorySchema), updateCategoryByAdmin);
router.delete("/:categoryId", validate(categoryIdParamSchema), deleteCategoryByAdmin);

export default router;