import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  createTag,
  deleteTag,
  getTagById,
  listPublicTags,
  listTags,
  updateTag,
} from "./tag.service.js";

export const createTagByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const tag = await createTag(body);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "Tag",
    entityId: tag.id,
    newValue: tag,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { tag }, "Tag created successfully"));
});

export const listTagsByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listTags(query);

  return res.status(200).json(new ApiResponse(200, result, "Tags fetched successfully"));
});

export const getTagByAdmin = asyncHandler(async (req, res) => {
  const { tagId } = req.validated.params;

  const tag = await getTagById(tagId);

  return res.status(200).json(new ApiResponse(200, { tag }, "Tag fetched successfully"));
});

export const updateTagByAdmin = asyncHandler(async (req, res) => {
  const { tagId } = req.validated.params;
  const { body } = req.validated;

  const oldTag = await getTagById(tagId);
  const tag = await updateTag({ tagId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "Tag",
    entityId: tag.id,
    oldValue: oldTag,
    newValue: tag,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { tag }, "Tag updated successfully"));
});

export const deleteTagByAdmin = asyncHandler(async (req, res) => {
  const { tagId } = req.validated.params;

  const oldTag = await getTagById(tagId);
  const result = await deleteTag(tagId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "Tag",
    entityId: tagId,
    oldValue: oldTag,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, result, "Tag deleted successfully"));
});

export const listTagsPublic = asyncHandler(async (req, res) => {
  const tags = await listPublicTags();

  return res.status(200).json(new ApiResponse(200, { tags }, "Tags fetched successfully"));
});