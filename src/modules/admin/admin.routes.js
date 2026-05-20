import { Router } from "express";

import { authenticate, requireAdmin } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware.js";

import {
  createUserByAdmin,
  deleteUserByAdmin,
  getUserByAdmin,
  listUsersByAdmin,
  resetUserPasswordByAdmin,
  updateUserByAdmin,
} from "./adminUser.controller.js";

import {
  adminCreateUserSchema,
  adminListUsersSchema,
  adminResetUserPasswordSchema,
  adminUpdateUserSchema,
  adminUserIdParamSchema,
} from "./adminUser.validation.js";

import categoryAdminRoutes from "../categories/category.admin.routes.js";
import tagAdminRoutes from "../tags/tag.admin.routes.js";
import courseAdminRoutes from "../courses/course.admin.routes.js";
import lectureAdminRoutes from "../lectures/lecture.admin.routes.js";
import mediaAdminRoutes from "../media/media.admin.routes.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.post("/users", authRateLimiter, validate(adminCreateUserSchema), createUserByAdmin);
router.get("/users", validate(adminListUsersSchema), listUsersByAdmin);
router.get("/users/:userId", validate(adminUserIdParamSchema), getUserByAdmin);
router.patch("/users/:userId", validate(adminUpdateUserSchema), updateUserByAdmin);
router.patch(
  "/users/:userId/reset-password",
  authRateLimiter,
  validate(adminResetUserPasswordSchema),
  resetUserPasswordByAdmin
);
router.delete("/users/:userId", validate(adminUserIdParamSchema), deleteUserByAdmin);

router.use("/categories", categoryAdminRoutes);
router.use("/tags", tagAdminRoutes);
router.use("/courses", courseAdminRoutes);
router.use("/", lectureAdminRoutes);
router.use("/media", mediaAdminRoutes);

export default router;