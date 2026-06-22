import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  getAdminBookOrderById,
  getMyBookOrderById,
  listAdminBookOrders,
  listMyBookOrders,
  placeBookOrder,
  updateBookOrderStatus,
} from "./book-order.service.js";

// ─── Admin ────────────────────────────────────────────────────────────────────

export const listBookOrdersByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listAdminBookOrders(query);

  return res.status(200).json(new ApiResponse(200, result, "Book orders fetched successfully"));
});

export const getBookOrderByAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;

  const order = await getAdminBookOrderById(orderId);

  return res.status(200).json(new ApiResponse(200, { order }, "Book order fetched successfully"));
});

export const updateBookOrderStatusByAdmin = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;
  const { body } = req.validated;

  const oldOrder = await getAdminBookOrderById(orderId);
  const order = await updateBookOrderStatus({ orderId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "BookOrder",
    entityId: order.id,
    oldValue: { status: oldOrder.status },
    newValue: { status: order.status, adminNotes: order.adminNotes },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { order }, "Book order status updated successfully"));
});

// ─── User ─────────────────────────────────────────────────────────────────────

export const placeBookOrderByUser = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { body } = req.validated;

  const order = await placeBookOrder({ userId: req.user.id, bookId, ...body });

  return res
    .status(201)
    .json(new ApiResponse(201, { order }, "Order placed successfully"));
});

export const listMyBookOrdersByUser = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listMyBookOrders({ userId: req.user.id, ...query });

  return res.status(200).json(new ApiResponse(200, result, "Your orders fetched successfully"));
});

export const getMyBookOrderByUser = asyncHandler(async (req, res) => {
  const { orderId } = req.validated.params;

  const order = await getMyBookOrderById({ userId: req.user.id, orderId });

  return res.status(200).json(new ApiResponse(200, { order }, "Order fetched successfully"));
});
