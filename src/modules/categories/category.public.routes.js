import { Router } from "express";

import { listCategoriesPublic } from "./category.controller.js";

const router = Router();

router.get("/", listCategoriesPublic);

export default router;