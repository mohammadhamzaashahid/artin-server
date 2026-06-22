import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { formatMediaAssetForResponse } from "../media/media.service.js";
import { buildAudioFileAccessView, getBookAccessForUser } from "./book-access.service.js";
import { validateBookExists } from "./book.service.js";

// ─── Include / format helpers ─────────────────────────────────────────────────

const audioFileAdminInclude = {
  audioMediaAsset: {
    select: {
      id: true,
      provider: true,
      objectKey: true,
      publicUrl: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      mediaKind: true,
      uploadStatus: true,
    },
  },
};

export const formatAudioFileForResponse = (audioFile) => {
  if (!audioFile) return null;
  return {
    ...audioFile,
    audioMediaAsset: formatMediaAssetForResponse(audioFile.audioMediaAsset),
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validateAudioAsset = async (mediaAssetId) => {
  if (!mediaAssetId) return;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    select: { id: true, mediaKind: true, uploadStatus: true },
  });

  if (!asset) throw new ApiError(400, "Media asset not found");
  if (asset.mediaKind !== "AUDIO") throw new ApiError(400, "Media asset must be of type AUDIO");
  if (!["UPLOADED", "READY"].includes(asset.uploadStatus)) {
    throw new ApiError(400, "Media asset is not ready to attach");
  }
};

const getNextAudioOrder = async (bookId) => {
  const last = await prisma.bookAudioFile.findFirst({
    where: { bookId },
    orderBy: { audioOrder: "desc" },
    select: { audioOrder: true },
  });
  return (last?.audioOrder ?? 0) + 1;
};

const ensureAudioOrderAvailable = async ({ bookId, audioOrder, excludeId = null }) => {
  const existing = await prisma.bookAudioFile.findFirst({
    where: {
      bookId,
      audioOrder,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, "Audio order already in use for this book");
};

const getAudioFileById = async (audioFileId, bookId = null) => {
  const audioFile = await prisma.bookAudioFile.findUnique({
    where: { id: audioFileId },
    include: audioFileAdminInclude,
  });

  if (!audioFile || audioFile.deletedAt) {
    throw new ApiError(404, "Audio file not found");
  }

  if (bookId && audioFile.bookId !== bookId) {
    throw new ApiError(404, "Audio file not found on this book");
  }

  return formatAudioFileForResponse(audioFile);
};

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export const createBookAudioFile = async ({
  bookId,
  title,
  description,
  audioOrder,
  isPreviewFree,
  status,
  audioMediaAssetId,
  durationSeconds,
}) => {
  await validateBookExists(bookId);
  await validateAudioAsset(audioMediaAssetId);

  const finalOrder = audioOrder ?? (await getNextAudioOrder(bookId));
  await ensureAudioOrderAvailable({ bookId, audioOrder: finalOrder });

  const audioFile = await prisma.bookAudioFile.create({
    data: {
      bookId,
      title: title.trim(),
      description: description || null,
      audioOrder: finalOrder,
      isPreviewFree: isPreviewFree ?? false,
      status: status ?? "DRAFT",
      audioMediaAssetId: audioMediaAssetId || null,
      durationSeconds: durationSeconds ?? null,
    },
    include: audioFileAdminInclude,
  });

  return formatAudioFileForResponse(audioFile);
};

export const listBookAudioFilesByBook = async ({ bookId, includeDeleted }) => {
  await validateBookExists(bookId);

  const audioFiles = await prisma.bookAudioFile.findMany({
    where: {
      bookId,
      ...(includeDeleted === "true" ? {} : { deletedAt: null }),
    },
    include: audioFileAdminInclude,
    orderBy: { audioOrder: "asc" },
  });

  return audioFiles.map(formatAudioFileForResponse);
};

export const getBookAudioFileById = async ({ bookId, audioFileId }) => {
  return getAudioFileById(audioFileId, bookId);
};

export const updateBookAudioFile = async ({
  bookId,
  audioFileId,
  title,
  description,
  audioOrder,
  isPreviewFree,
  status,
  audioMediaAssetId,
  durationSeconds,
}) => {
  const existing = await getAudioFileById(audioFileId, bookId);

  if (typeof audioMediaAssetId !== "undefined") {
    await validateAudioAsset(audioMediaAssetId);
  }

  if (typeof audioOrder !== "undefined" && audioOrder !== existing.audioOrder) {
    await ensureAudioOrderAvailable({ bookId, audioOrder, excludeId: audioFileId });
  }

  const data = {};
  if (typeof title !== "undefined") data.title = title.trim();
  if (typeof description !== "undefined") data.description = description || null;
  if (typeof audioOrder !== "undefined") data.audioOrder = audioOrder;
  if (typeof isPreviewFree !== "undefined") data.isPreviewFree = isPreviewFree;
  if (typeof status !== "undefined") data.status = status;
  if (typeof audioMediaAssetId !== "undefined") data.audioMediaAssetId = audioMediaAssetId || null;
  if (typeof durationSeconds !== "undefined") data.durationSeconds = durationSeconds ?? null;

  const audioFile = await prisma.bookAudioFile.update({
    where: { id: audioFileId },
    data,
    include: audioFileAdminInclude,
  });

  return formatAudioFileForResponse(audioFile);
};

export const softDeleteBookAudioFile = async ({ bookId, audioFileId }) => {
  const existing = await getAudioFileById(audioFileId, bookId);

  const nextOrder = await getNextAudioOrder(bookId);

  const audioFile = await prisma.bookAudioFile.update({
    where: { id: audioFileId },
    data: {
      audioOrder: nextOrder,
      status: "ARCHIVED",
      deletedAt: new Date(),
    },
    include: audioFileAdminInclude,
  });

  return formatAudioFileForResponse(audioFile);
};

export const reorderBookAudioFiles = async ({ bookId, audioFiles }) => {
  await validateBookExists(bookId);

  if (audioFiles.length === 0) {
    return listBookAudioFilesByBook({ bookId, includeDeleted: "false" });
  }

  const audioFileIds = audioFiles.map((a) => a.audioFileId);
  const audioOrders = audioFiles.map((a) => a.audioOrder);

  if (new Set(audioFileIds).size !== audioFiles.length) {
    throw new ApiError(400, "Duplicate audioFileId values are not allowed");
  }

  if (new Set(audioOrders).size !== audioFiles.length) {
    throw new ApiError(400, "Duplicate audioOrder values are not allowed");
  }

  const existing = await prisma.bookAudioFile.findMany({
    where: { bookId, deletedAt: null },
    select: { id: true },
  });

  const existingIdSet = new Set(existing.map((a) => a.id));
  for (const item of audioFiles) {
    if (!existingIdSet.has(item.audioFileId)) {
      throw new ApiError(400, "One or more audioFileIds do not belong to this book");
    }
  }

  // Check that target orders are not claimed by audio files outside this reorder set
  const conflicting = await prisma.bookAudioFile.findFirst({
    where: {
      bookId,
      audioOrder: { in: audioOrders },
      NOT: { id: { in: audioFileIds } },
    },
    select: { id: true, deletedAt: true },
  });

  if (conflicting) {
    throw new ApiError(
      409,
      conflicting.deletedAt
        ? "An audio order value is reserved by an archived file"
        : "Audio order value is already in use"
    );
  }

  // Two-phase update to avoid unique constraint violations
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      audioFiles.map((item, index) =>
        tx.bookAudioFile.update({
          where: { id: item.audioFileId },
          data: { audioOrder: -(index + 1) },
        })
      )
    );

    await Promise.all(
      audioFiles.map((item) =>
        tx.bookAudioFile.update({
          where: { id: item.audioFileId },
          data: { audioOrder: item.audioOrder },
        })
      )
    );
  });

  return listBookAudioFilesByBook({ bookId, includeDeleted: "false" });
};

// ─── Audio playback (user / public) ──────────────────────────────────────────

export const getBookAudioPlaybackUrl = async ({ userId, bookId, audioFileId }) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true, slug: true, status: true, deletedAt: true },
  });

  if (!book || book.deletedAt || book.status !== "PUBLISHED") {
    throw new ApiError(404, "Book not found");
  }

  const audioFile = await prisma.bookAudioFile.findUnique({
    where: { id: audioFileId },
    select: {
      id: true,
      bookId: true,
      title: true,
      audioOrder: true,
      isPreviewFree: true,
      status: true,
      deletedAt: true,
      durationSeconds: true,
      audioMediaAsset: true,
    },
  });

  if (!audioFile || audioFile.deletedAt || audioFile.bookId !== bookId) {
    throw new ApiError(404, "Audio file not found");
  }

  if (audioFile.status !== "PUBLISHED") {
    throw new ApiError(403, "Audio file is not available");
  }

  const bookAccess = await getBookAccessForUser({ userId, bookId });
  const audioAccess = buildAudioFileAccessView({
    audioFile: {
      id: audioFile.id,
      isPreviewFree: audioFile.isPreviewFree,
      status: audioFile.status,
    },
    bookAccess,
  });

  if (!audioAccess.canPlay) {
    throw new ApiError(403, "You do not have access to this audio file", [
      { reason: audioAccess.lockReason },
    ]);
  }

  const mediaAsset = audioFile.audioMediaAsset;

  if (!mediaAsset) {
    throw new ApiError(404, "No audio file attached to this track");
  }

  if (!["UPLOADED", "READY"].includes(mediaAsset.uploadStatus)) {
    throw new ApiError(400, "Audio media is not ready");
  }

  const { url } = formatMediaAssetForResponse(mediaAsset);

  return {
    audioFile: {
      id: audioFile.id,
      title: audioFile.title,
      bookId: audioFile.bookId,
      bookSlug: book.slug,
      isPreviewFree: audioFile.isPreviewFree,
      durationSeconds: audioFile.durationSeconds ?? mediaAsset.durationSeconds,
    },
    playback: {
      url,
      mimeType: mediaAsset.mimeType,
    },
  };
};
