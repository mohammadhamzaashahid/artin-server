import fs from "fs";
import crypto from "crypto";
import path from "path";

import { prisma } from "../../config/prisma.js";
import { buildLocalPublicUrl, ensureDir, getUploadsDir } from "../../config/storage.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { buildLectureAccessView, getCourseAccessForUser } from "../access/access.service.js";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;

const mediaFolderByKind = {
  IMAGE: "images",
  AUDIO: "audio",
  VIDEO: "video",
  DOCUMENT: "documents",
};

const allowedMimeByKind = {
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
  AUDIO: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
  ],
  VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
  DOCUMENT: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
  ],
};

const maxSizeByKind = {
  IMAGE: MAX_IMAGE_SIZE_BYTES,
  AUDIO: MAX_AUDIO_SIZE_BYTES,
  VIDEO: MAX_VIDEO_SIZE_BYTES,
  DOCUMENT: MAX_DOCUMENT_SIZE_BYTES,
};

const sanitizeFileName = (fileName) => {
  const ext = path.extname(fileName || "").toLowerCase();
  const base = path
    .basename(fileName || "file", ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return {
    base: base || "file",
    ext,
  };
};

const buildObjectKey = ({ mediaKind, fileName }) => {
  const folder = mediaFolderByKind[mediaKind];

  if (!folder) {
    throw new ApiError(400, "Invalid media kind");
  }

  const { base, ext } = sanitizeFileName(fileName);
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const random = crypto.randomBytes(12).toString("hex");

  return `${folder}/${yyyy}/${mm}/${random}-${base}${ext}`;
};

const validateMediaPayload = ({ mediaKind, mimeType, fileSizeBytes }) => {
  const allowedMimeTypes = allowedMimeByKind[mediaKind] || [];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new ApiError(400, `Invalid MIME type "${mimeType}" for ${mediaKind}`);
  }

  const maxSize = maxSizeByKind[mediaKind];

  if (fileSizeBytes > maxSize) {
    throw new ApiError(400, `File is too large for ${mediaKind}`);
  }
};

// Always rebuild the public URL from objectKey for LOCAL assets so the URL
// reflects the current SERVER_BASE_URL — this means changing the tunnel or
// VPS domain never requires a DB migration.
const resolvePublicUrl = (asset) => {
  if (asset.provider === "LOCAL" && asset.objectKey) {
    return buildLocalPublicUrl(asset.objectKey);
  }
  return asset.publicUrl || null;
};

export const formatMediaAssetForResponse = (asset) => {
  if (!asset) return asset;

  const publicUrl = resolvePublicUrl(asset);

  return {
    ...asset,
    publicUrl,
    url: publicUrl,
    fileSizeBytes:
      typeof asset.fileSizeBytes === "bigint"
        ? asset.fileSizeBytes.toString()
        : asset.fileSizeBytes,
  };
};

// Returns a preview descriptor — returns null for assets not yet ready so the
// caller can fall back to directUrl gracefully instead of throwing a 400.
export const buildMediaPreview = (asset) => {
  if (!asset) return null;

  if (!["UPLOADED", "READY"].includes(asset.uploadStatus)) return null;

  const url = resolvePublicUrl(asset);

  return {
    url,
    mimeType: asset.mimeType,
    isSigned: false,
  };
};

export const formatMediaAssetWithPreviewForResponse = async (asset) => {
  if (!asset) return asset;

  return {
    ...formatMediaAssetForResponse(asset),
    preview: buildMediaPreview(asset),
  };
};

const normalizeMediaAssetList = (items) => items.map(formatMediaAssetForResponse);

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadMediaFile = async ({ adminUserId, file, mediaKind, durationSeconds }) => {
  const tempPath = file.path;

  try {
    validateMediaPayload({
      mediaKind,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });

    const objectKey = buildObjectKey({ mediaKind, fileName: file.originalname });
    const uploadsDir = getUploadsDir();
    const targetPath = path.join(uploadsDir, objectKey);

    await ensureDir(path.dirname(targetPath));
    await fs.promises.rename(tempPath, targetPath);

    const publicUrl = buildLocalPublicUrl(objectKey);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        provider: "LOCAL",
        bucketName: uploadsDir,
        objectKey,
        publicUrl,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: BigInt(file.size),
        durationSeconds: durationSeconds ?? null,
        mediaKind,
        uploadStatus: "UPLOADED",
        createdByAdminId: adminUserId,
      },
    });

    return formatMediaAssetForResponse(mediaAsset);
  } catch (error) {
    // Best-effort cleanup of the temp file if it still exists
    fs.promises.unlink(tempPath).catch(() => {});
    throw error;
  }
};

// ─── List / Get ───────────────────────────────────────────────────────────────

export const listMediaAssets = async ({ page, limit, mediaKind, uploadStatus, search }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    ...(mediaKind ? { mediaKind } : {}),
    ...(uploadStatus ? { uploadStatus } : {}),
    ...(search
      ? {
          OR: [
            { originalFilename: { contains: search, mode: "insensitive" } },
            { objectKey: { contains: search, mode: "insensitive" } },
            { mimeType: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        createdByAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return {
    items: normalizeMediaAssetList(items),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getMediaAssetById = async (mediaAssetId) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!mediaAsset) {
    throw new ApiError(404, "Media asset not found");
  }

  return formatMediaAssetForResponse(mediaAsset);
};

export const getMediaAssetPreviewUrl = async (mediaAssetId) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
  });

  if (!mediaAsset) {
    throw new ApiError(404, "Media asset not found");
  }

  return {
    mediaAsset: formatMediaAssetForResponse(mediaAsset),
    preview: buildMediaPreview(mediaAsset),
  };
};

export const getPublicCourseImagePreviewUrl = async (mediaAssetId) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
  });

  if (!mediaAsset) {
    throw new ApiError(404, "Media asset not found");
  }

  if (mediaAsset.mediaKind !== "IMAGE") {
    throw new ApiError(400, "Only course images can be previewed from this endpoint");
  }

  const attachedCourse = await prisma.course.findFirst({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      OR: [
        { thumbnailImageAssetId: mediaAsset.id },
        { bannerImageAssetId: mediaAsset.id },
      ],
    },
    select: { id: true, slug: true },
  });

  if (!attachedCourse) {
    throw new ApiError(404, "Public course image not found");
  }

  return {
    course: attachedCourse,
    mediaAsset: formatMediaAssetForResponse(mediaAsset),
    preview: buildMediaPreview(mediaAsset),
  };
};

export const getPublicCourseImagePreviewByCourse = async ({ slug, imageType }) => {
  const course = await prisma.course.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true,
      slug: true,
      thumbnailImageAsset: true,
      bannerImageAsset: true,
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const mediaAsset =
    imageType === "thumbnail" ? course.thumbnailImageAsset : course.bannerImageAsset;

  if (!mediaAsset) {
    throw new ApiError(404, `Course ${imageType} image not found`);
  }

  if (mediaAsset.mediaKind !== "IMAGE") {
    throw new ApiError(400, "Course media asset is not an image");
  }

  return {
    course: { id: course.id, slug: course.slug },
    imageType,
    mediaAsset: formatMediaAssetForResponse(mediaAsset),
    preview: buildMediaPreview(mediaAsset),
  };
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteMediaAsset = async (mediaAssetId) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    include: {
      courseThumbnails: { select: { id: true } },
      courseBanners: { select: { id: true } },
      courseOutlineDocuments: { select: { id: true } },
      courseFlyerAssets: { select: { id: true } },
      lectureAudios: { select: { id: true } },
      lectureVideos: { select: { id: true } },
      bookCoverImages: { select: { id: true } },
      bookAudioFiles: { select: { id: true } },
    },
  });

  if (!mediaAsset) {
    throw new ApiError(404, "Media asset not found");
  }

  const detachedFrom = {
    courseThumbnails: mediaAsset.courseThumbnails.length,
    courseBanners: mediaAsset.courseBanners.length,
    courseOutlineDocuments: mediaAsset.courseOutlineDocuments.length,
    courseFlyerAssets: mediaAsset.courseFlyerAssets.length,
    lectureAudios: mediaAsset.lectureAudios.length,
    lectureVideos: mediaAsset.lectureVideos.length,
    bookCoverImages: mediaAsset.bookCoverImages.length,
    bookAudioFiles: mediaAsset.bookAudioFiles.length,
  };

  await prisma.$transaction(async (tx) => {
    await tx.course.updateMany({
      where: { thumbnailImageAssetId: mediaAsset.id },
      data: { thumbnailImageAssetId: null },
    });

    await tx.course.updateMany({
      where: { bannerImageAssetId: mediaAsset.id },
      data: { bannerImageAssetId: null },
    });

    await tx.course.updateMany({
      where: { outlineDocumentAssetId: mediaAsset.id },
      data: { outlineDocumentAssetId: null },
    });

    await tx.courseFlyerAsset.deleteMany({
      where: { mediaAssetId: mediaAsset.id },
    });

    await tx.lecture.updateMany({
      where: { audioMediaAssetId: mediaAsset.id },
      data: { audioMediaAssetId: null },
    });

    await tx.lecture.updateMany({
      where: { videoMediaAssetId: mediaAsset.id },
      data: { videoMediaAssetId: null },
    });

    // Book cover images are deleted via onDelete: Cascade but we remove them
    // explicitly here so detachedFrom counts are accurate before the parent delete.
    await tx.bookCoverImage.deleteMany({
      where: { mediaAssetId: mediaAsset.id },
    });

    // Book audio file links are nulled via onDelete: SetNull; we match that here.
    await tx.bookAudioFile.updateMany({
      where: { audioMediaAssetId: mediaAsset.id },
      data: { audioMediaAssetId: null },
    });

    await tx.mediaAsset.delete({ where: { id: mediaAsset.id } });
  });

  // Delete the physical file — best-effort; log but don't throw if missing
  if (mediaAsset.objectKey) {
    const filePath = path.join(getUploadsDir(), mediaAsset.objectKey);
    fs.promises.unlink(filePath).catch((err) => {
      console.error("Failed to delete media file from disk:", {
        filePath,
        message: err.message,
      });
    });
  }

  return { deleted: true, detachedFrom };
};

// ─── Playback ─────────────────────────────────────────────────────────────────

export const getLecturePlaybackUrl = async ({ userId, lectureId }) => {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      id: true,
      title: true,
      description: true,
      lectureOrder: true,
      isPreviewFree: true,
      status: true,
      deletedAt: true,
      audioMediaAssetId: true,
      videoMediaAssetId: true,
      courseId: true,
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
      audioMediaAsset: true,
      videoMediaAsset: true,
    },
  });

  if (!lecture || lecture.deletedAt) {
    throw new ApiError(404, "Lecture not found");
  }

  if (lecture.status !== "PUBLISHED") {
    throw new ApiError(403, "Lecture is not available");
  }

  if (!lecture.course || lecture.course.deletedAt || lecture.course.status !== "PUBLISHED") {
    throw new ApiError(403, "Course is not available");
  }

  const courseAccess = await getCourseAccessForUser({
    userId,
    courseId: lecture.courseId,
  });

  const lectureAccess = buildLectureAccessView({
    lecture: {
      id: lecture.id,
      title: lecture.title,
      description: lecture.description,
      lectureOrder: lecture.lectureOrder,
      isPreviewFree: lecture.isPreviewFree,
      status: lecture.status,
    },
    courseAccess,
  });

  if (!lectureAccess.canPlay) {
    throw new ApiError(403, "You do not have access to this lecture", [
      { reason: lectureAccess.lockReason },
    ]);
  }

  const mediaAsset = lecture.audioMediaAsset || lecture.videoMediaAsset;

  if (!mediaAsset) {
    throw new ApiError(404, "No media file attached to this lecture");
  }

  if (!["UPLOADED", "READY"].includes(mediaAsset.uploadStatus)) {
    throw new ApiError(400, "Lecture media is not ready");
  }

  const playbackUrl = resolvePublicUrl(mediaAsset);

  return {
    lecture: {
      id: lecture.id,
      title: lecture.title,
      courseId: lecture.courseId,
      courseSlug: lecture.course.slug,
      isPreviewFree: lecture.isPreviewFree,
      mediaKind: mediaAsset.mediaKind,
      durationSeconds: mediaAsset.durationSeconds,
    },
    playback: {
      url: playbackUrl,
      mimeType: mediaAsset.mimeType,
    },
  };
};
