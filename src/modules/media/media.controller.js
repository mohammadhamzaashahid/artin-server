import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  completeMediaUpload,
  createSignedUploadUrl,
  deleteMediaAsset,
  getLecturePlaybackUrl,
  getMediaAssetById,
  getMediaAssetPreviewUrl,
  getPublicCourseImagePreviewByCourse,
  getPublicCourseImagePreviewUrl,
  listMediaAssets,
} from "./media.service.js";

export const createUploadUrlByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await createSignedUploadUrl({
    adminUserId: req.user.id,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPLOAD",
    entityType: "MediaAsset",
    entityId: result.mediaAsset.id,
    newValue: {
      mediaAsset: result.mediaAsset,
      upload: {
        method: result.upload.method,
        expiresIn: result.upload.expiresIn,
        headers: result.upload.headers,
      },
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, result, "Signed upload URL created successfully"));
});

export const completeUploadByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const mediaAsset = await completeMediaUpload(body);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "MediaAsset",
    entityId: mediaAsset.id,
    newValue: mediaAsset,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { mediaAsset }, "Media upload completed successfully"));
});

export const listMediaAssetsByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listMediaAssets(query);

  return res.status(200).json(new ApiResponse(200, result, "Media assets fetched successfully"));
});

export const getMediaAssetByAdmin = asyncHandler(async (req, res) => {
  const { mediaAssetId } = req.validated.params;

  const mediaAsset = await getMediaAssetById(mediaAssetId);

  return res.status(200).json(new ApiResponse(200, { mediaAsset }, "Media asset fetched successfully"));
});

export const getMediaAssetPreviewUrlByAdmin = asyncHandler(async (req, res) => {
  const { mediaAssetId } = req.validated.params;

  const result = await getMediaAssetPreviewUrl(mediaAssetId);

  return res.status(200).json(new ApiResponse(200, result, "Media preview URL generated successfully"));
});

export const getPublicCourseImagePreviewUrlController = asyncHandler(async (req, res) => {
  const { mediaAssetId } = req.validated.params;

  const result = await getPublicCourseImagePreviewUrl(mediaAssetId);

  return res.status(200).json(new ApiResponse(200, result, "Course image preview URL generated successfully"));
});

export const getPublicCourseImagePreviewByCourseController = asyncHandler(async (req, res) => {
  const { slug, imageType } = req.validated.params;

  const result = await getPublicCourseImagePreviewByCourse({
    slug,
    imageType,
  });

  return res.status(200).json(new ApiResponse(200, result, "Course image preview URL generated successfully"));
});

export const deleteMediaAssetByAdmin = asyncHandler(async (req, res) => {
  const { mediaAssetId } = req.validated.params;

  const oldMediaAsset = await getMediaAssetById(mediaAssetId);
  const result = await deleteMediaAsset(mediaAssetId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "MediaAsset",
    entityId: mediaAssetId,
    oldValue: oldMediaAsset,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, result, "Media asset deleted successfully"));
});

export const getLecturePlaybackUrlController = asyncHandler(async (req, res) => {
  const { lectureId } = req.validated.params;

  const result = await getLecturePlaybackUrl({
    userId: req.user?.id || null,
    lectureId,
  });

  return res.status(200).json(new ApiResponse(200, result, "Playback URL generated successfully"));
});
