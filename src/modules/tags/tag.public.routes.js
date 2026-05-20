import { Router } from "express";

import { listTagsPublic } from "./tag.controller.js";

const router = Router();

router.get("/", listTagsPublic);

export default router;