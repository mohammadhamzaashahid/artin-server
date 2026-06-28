import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  createLiveClass,
  createLiveClassPrice,
  deactivateLiveClassPrice,
  getAdminLiveClassById,
  getLiveClassPriceById,
  getPublicLiveClassBySlug,
  listAdminLiveClasses,
  listLiveClassPrices,
  listPublicLiveClasses,
  publishLiveClass,
  softDeleteLiveClass,
  unpublishLiveClass,
  updateLiveClass,
  updateLiveClassPrice,
} from "./liveClass.service.js";

export const createLiveClassByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const liveClass = await createLiveClass({
    adminUserId: req.user.id,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "LiveClass",
    entityId: liveClass.id,
    newValue: liveClass,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { liveClass }, "Live class created successfully"));
});

export const listLiveClassesByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listAdminLiveClasses(query);

  return res.status(200).json(new ApiResponse(200, result, "Live classes fetched successfully"));
});

export const getLiveClassByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;

  const liveClass = await getAdminLiveClassById(liveClassId);

  return res.status(200).json(new ApiResponse(200, { liveClass }, "Live class fetched successfully"));
});

export const updateLiveClassByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;
  const { body } = req.validated;

  const oldLiveClass = await getAdminLiveClassById(liveClassId);
  const liveClass = await updateLiveClass({ liveClassId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "LiveClass",
    entityId: liveClass.id,
    oldValue: oldLiveClass,
    newValue: liveClass,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { liveClass }, "Live class updated successfully"));
});

export const deleteLiveClassByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;

  const oldLiveClass = await getAdminLiveClassById(liveClassId);
  const liveClass = await softDeleteLiveClass(liveClassId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "LiveClass",
    entityId: liveClass.id,
    oldValue: oldLiveClass,
    newValue: liveClass,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { liveClass }, "Live class archived successfully"));
});

export const publishLiveClassByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;

  const oldLiveClass = await getAdminLiveClassById(liveClassId);
  const liveClass = await publishLiveClass(liveClassId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "PUBLISH",
    entityType: "LiveClass",
    entityId: liveClass.id,
    oldValue: oldLiveClass,
    newValue: liveClass,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { liveClass }, "Live class published successfully"));
});

export const unpublishLiveClassByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;

  const oldLiveClass = await getAdminLiveClassById(liveClassId);
  const liveClass = await unpublishLiveClass(liveClassId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UNPUBLISH",
    entityType: "LiveClass",
    entityId: liveClass.id,
    oldValue: oldLiveClass,
    newValue: liveClass,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { liveClass }, "Live class unpublished successfully"));
});

export const createLiveClassPriceByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;
  const { body } = req.validated;

  const price = await createLiveClassPrice({ liveClassId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "LiveClassPrice",
    entityId: price.id,
    newValue: price,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { price }, "Live class price created successfully"));
});

export const listLiveClassPricesByAdmin = asyncHandler(async (req, res) => {
  const { liveClassId } = req.validated.params;

  const prices = await listLiveClassPrices(liveClassId);

  return res
    .status(200)
    .json(new ApiResponse(200, { prices }, "Live class prices fetched successfully"));
});

export const updateLiveClassPriceByAdmin = asyncHandler(async (req, res) => {
  const { priceId } = req.validated.params;
  const { body } = req.validated;

  const price = await updateLiveClassPrice({ priceId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "LiveClassPrice",
    entityId: price.id,
    newValue: price,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { price }, "Live class price updated successfully"));
});

export const deleteLiveClassPriceByAdmin = asyncHandler(async (req, res) => {
  const { priceId } = req.validated.params;

  const price = await deactivateLiveClassPrice(priceId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "LiveClassPrice",
    entityId: price.id,
    newValue: price,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { price }, "Live class price deactivated successfully"));
});

export const listLiveClassesPublic = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listPublicLiveClasses(query);

  return res.status(200).json(new ApiResponse(200, result, "Live classes fetched successfully"));
});

export const getLiveClassPublic = asyncHandler(async (req, res) => {
  const { slug } = req.validated.params;

  const liveClass = await getPublicLiveClassBySlug({
    slug,
    userId: req.user?.id || null,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { liveClass }, "Live class fetched successfully"));
});
