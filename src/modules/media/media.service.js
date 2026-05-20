import crypto from "crypto";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { ensureR2Configured, getR2BucketName, getR2Client } from "../../config/r2.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { buildLectureAccessView, getCourseAccessForUser } from "../access/access.service.js";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

const mediaFolderByKind = {
  IMAGE: "images",
  AUDIO: "audio",
  VIDEO: "video",
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
};

const maxSizeByKind = {
  IMAGE: MAX_IMAGE_SIZE_BYTES,
  AUDIO: MAX_AUDIO_SIZE_BYTES,
  VIDEO: MAX_VIDEO_SIZE_BYTES,
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
    throw new ApiError(400, `Invalid MIME type for ${mediaKind}`);
  }

  const maxSize = maxSizeByKind[mediaKind];

  if (fileSizeBytes > maxSize) {
    throw new ApiError(400, `File is too large for ${mediaKind}`);
  }
};

const normalizeBigIntMediaAsset = (asset) => {
  if (!asset) return asset;

  return {
    ...asset,
    fileSizeBytes:
      typeof asset.fileSizeBytes === "bigint"
        ? asset.fileSizeBytes.toString()
        : asset.fileSizeBytes,
  };
};

const normalizeMediaAssetList = (items) => {
  return items.map(normalizeBigIntMediaAsset);
};

export const createSignedUploadUrl = async ({
  adminUserId,
  mediaKind,
  fileName,
  mimeType,
  fileSizeBytes,
  durationSeconds,
}) => {
  ensureR2Configured();
  validateMediaPayload({ mediaKind, mimeType, fileSizeBytes });

  const objectKey = buildObjectKey({
    mediaKind,
    fileName,
  });

  const mediaAsset = await prisma.mediaAsset.create({
    data: {
      provider: "R2",
      bucketName: env.R2_BUCKET_NAME,
      objectKey,
      originalFilename: fileName,
      mimeType,
      fileSizeBytes: BigInt(fileSizeBytes),
      durationSeconds: durationSeconds ?? null,
      mediaKind,
      uploadStatus: "PENDING",
      createdByAdminId: adminUserId,
    },
  });

  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: objectKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn: env.R2_SIGNED_UPLOAD_EXPIRES_SECONDS,
  });

  return {
    mediaAsset: normalizeBigIntMediaAsset(mediaAsset),
    upload: {
      method: "PUT",
      url: uploadUrl,
      expiresIn: env.R2_SIGNED_UPLOAD_EXPIRES_SECONDS,
      headers: {
        "Content-Type": mimeType,
      },
    },
  };
};

export const completeMediaUpload = async ({ mediaAssetId, durationSeconds }) => {
  ensureR2Configured();

  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: {
      id: mediaAssetId,
    },
  });

  if (!mediaAsset) {
    throw new ApiError(404, "Media asset not found");
  }

  if (mediaAsset.provider !== "R2") {
    throw new ApiError(400, "Only R2 media assets are supported");
  }

  try {
    const head = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: getR2BucketName(),
        Key: mediaAsset.objectKey,
      })
    );

    const updated = await prisma.mediaAsset.update({
      where: {
        id: mediaAsset.id,
      },
      data: {
        uploadStatus: "UPLOADED",
        fileSizeBytes:
          typeof head.ContentLength === "number"
            ? BigInt(head.ContentLength)
            : mediaAsset.fileSizeBytes,
        durationSeconds:
          typeof durationSeconds !== "undefined"
            ? durationSeconds
            : mediaAsset.durationSeconds,
      },
    });

    return normalizeBigIntMediaAsset(updated);
  } catch (error) {
    await prisma.mediaAsset.update({
      where: {
        id: mediaAsset.id,
      },
      data: {
        uploadStatus: "FAILED",
      },
    });

    throw new ApiError(
      400,
      "Upload could not be verified in Cloudflare R2. Please upload the file again",
      [
        {
          message: error.message,
        },
      ]
    );
  }
};

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
      orderBy: {
        createdAt: "desc",
      },
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
    where: {
      id: mediaAssetId,
    },
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

  return normalizeBigIntMediaAsset(mediaAsset);
};

export const deleteMediaAsset = async (mediaAssetId) => {
  ensureR2Configured();

  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: {
      id: mediaAssetId,
    },
    include: {
      courseThumbnails: {
        select: {
          id: true,
        },
      },
      courseBanners: {
        select: {
          id: true,
        },
      },
      lectureAudios: {
        select: {
          id: true,
        },
      },
      lectureVideos: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!mediaAsset) {
    throw new ApiError(404, "Media asset not found");
  }

  const isAttached =
    mediaAsset.courseThumbnails.length > 0 ||
    mediaAsset.courseBanners.length > 0 ||
    mediaAsset.lectureAudios.length > 0 ||
    mediaAsset.lectureVideos.length > 0;

  if (isAttached) {
    throw new ApiError(400, "Cannot delete media asset while it is attached to a course or lecture");
  }

  try {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: getR2BucketName(),
        Key: mediaAsset.objectKey,
      })
    );
  } catch (error) {
    console.error("Failed to delete object from R2:", {
      objectKey: mediaAsset.objectKey,
      message: error.message,
    });
  }

  await prisma.mediaAsset.delete({
    where: {
      id: mediaAsset.id,
    },
  });

  return {
    deleted: true,
  };
};

export const getLecturePlaybackUrl = async ({ userId, lectureId }) => {
  ensureR2Configured();

  const lecture = await prisma.lecture.findUnique({
    where: {
      id: lectureId,
    },
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
      {
        reason: lectureAccess.lockReason,
      },
    ]);
  }

  const mediaAsset = lecture.audioMediaAsset || lecture.videoMediaAsset;

  if (!mediaAsset) {
    throw new ApiError(404, "No media file attached to this lecture");
  }

  if (!["UPLOADED", "READY"].includes(mediaAsset.uploadStatus)) {
    throw new ApiError(400, "Lecture media is not ready");
  }

  const command = new R2_PUBLIC_BASE_URL({
    Bucket: getR2BucketName(),
    Key: mediaAsset.objectKey,
  });

  const playbackUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn: env.R2_SIGNED_PLAYBACK_EXPIRES_SECONDS,
  });

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
      expiresIn: env.R2_SIGNED_PLAYBACK_EXPIRES_SECONDS,
      mimeType: mediaAsset.mimeType,
    },
  };
};