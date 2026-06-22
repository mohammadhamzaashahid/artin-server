import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";

import {
  getBookOrderByAdmin,
  listBookOrdersByAdmin,
  updateBookOrderStatusByAdmin,
} from "./book-order.controller.js";

import {
  listAdminBookOrdersSchema,
  orderIdParamSchema,
  updateBookOrderStatusSchema,
} from "./book-order.validation.js";

const router = Router();

router.get("/", validate(listAdminBookOrdersSchema), listBookOrdersByAdmin);
router.get("/:orderId", validate(orderIdParamSchema), getBookOrderByAdmin);
router.patch("/:orderId/status", validate(updateBookOrderStatusSchema), updateBookOrderStatusByAdmin);

export default router;
