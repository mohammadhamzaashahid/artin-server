import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  createBookAudioFile,
  getBookAudioFileById,
  getBookAudioPlaybackUrl,
  listBookAudioFilesByBook,
  reorderBookAudioFiles,
  softDeleteBookAudioFile,
  updateBookAudioFile,
} from "./book-audio.service.js";

// ─── Admin ────────────────────────────────────────────────────────────────────

export const createBookAudioFileByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { body } = req.validated;

  const audioFile = await createBookAudioFile({ bookId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "BookAudioFile",
    entityId: audioFile.id,
    newValue: { bookId, title: audioFile.title, audioOrder: audioFile.audioOrder },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { audioFile }, "Audio file created successfully"));
});

export const listBookAudioFilesByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { includeDeleted } = req.validated.query;

  const audioFiles = await listBookAudioFilesByBook({ bookId, includeDeleted });

  return res
    .status(200)
    .json(new ApiResponse(200, { audioFiles }, "Audio files fetched successfully"));
});

export const getBookAudioFileByAdmin = asyncHandler(async (req, res) => {
  const { bookId, audioFileId } = req.validated.params;

  const audioFile = await getBookAudioFileById({ bookId, audioFileId });

  return res
    .status(200)
    .json(new ApiResponse(200, { audioFile }, "Audio file fetched successfully"));
});

export const updateBookAudioFileByAdmin = asyncHandler(async (req, res) => {
  const { bookId, audioFileId } = req.validated.params;
  const { body } = req.validated;

  const oldAudioFile = await getBookAudioFileById({ bookId, audioFileId });
  const audioFile = await updateBookAudioFile({ bookId, audioFileId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "BookAudioFile",
    entityId: audioFile.id,
    oldValue: { title: oldAudioFile.title, status: oldAudioFile.status },
    newValue: { title: audioFile.title, status: audioFile.status },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { audioFile }, "Audio file updated successfully"));
});

export const deleteBookAudioFileByAdmin = asyncHandler(async (req, res) => {
  const { bookId, audioFileId } = req.validated.params;

  const oldAudioFile = await getBookAudioFileById({ bookId, audioFileId });
  const audioFile = await softDeleteBookAudioFile({ bookId, audioFileId });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "BookAudioFile",
    entityId: audioFile.id,
    oldValue: { title: oldAudioFile.title, status: oldAudioFile.status },
    newValue: { status: audioFile.status, deletedAt: audioFile.deletedAt },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { audioFile }, "Audio file archived successfully"));
});

export const reorderBookAudioFilesByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { audioFiles } = req.validated.body;

  const result = await reorderBookAudioFiles({ bookId, audioFiles });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "REORDER",
    entityType: "Book",
    entityId: bookId,
    newValue: { action: "audio_files_reordered" },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { audioFiles: result }, "Audio files reordered successfully"));
});

// ─── User / public ────────────────────────────────────────────────────────────

export const getBookAudioPlayback = asyncHandler(async (req, res) => {
  const { bookId, audioFileId } = req.validated.params;

  const result = await getBookAudioPlaybackUrl({
    userId: req.user?.id || null,
    bookId,
    audioFileId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Playback URL retrieved successfully"));
});
