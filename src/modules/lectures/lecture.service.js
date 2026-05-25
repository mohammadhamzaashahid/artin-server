import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { formatMediaAssetForResponse } from "../media/media.service.js";

const lectureAdminInclude = {
  course: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      deletedAt: true,
    },
  },
  audioMediaAsset: {
    select: {
      id: true,
      objectKey: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      mediaKind: true,
      uploadStatus: true,
      createdAt: true,
    },
  },
  videoMediaAsset: {
    select: {
      id: true,
      objectKey: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      mediaKind: true,
      uploadStatus: true,
      createdAt: true,
    },
  },
};

const normalizeBigIntValue = (value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeBigIntValue);
  }

  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeBigIntValue(item)])
    );
  }

  return value;
};

const formatLectureForResponse = (lecture) => {
  const normalizedLecture = normalizeBigIntValue(lecture);

  if (!normalizedLecture) return normalizedLecture;

  return {
    ...normalizedLecture,
    audioMediaAsset: formatMediaAssetForResponse(normalizedLecture.audioMediaAsset),
    videoMediaAsset: formatMediaAssetForResponse(normalizedLecture.videoMediaAsset),
  };
};

const validateCourseExists = async (courseId) => {
  const course = await prisma.course.findUnique({
    where: {
      id: courseId,
    },
    select: {
      id: true,
      title: true,
      deletedAt: true,
    },
  });

  if (!course || course.deletedAt) {
    throw new ApiError(404, "Course not found");
  }

  return course;
};

const validateMediaAsset = async ({ mediaAssetId, expectedKind }) => {
  if (!mediaAssetId) return;

  const asset = await prisma.mediaAsset.findUnique({
    where: {
      id: mediaAssetId,
    },
    select: {
      id: true,
      mediaKind: true,
      uploadStatus: true,
    },
  });

  if (!asset) {
    throw new ApiError(400, "Invalid media asset ID");
  }

  if (asset.mediaKind !== expectedKind) {
    throw new ApiError(400, `Media asset must be of type ${expectedKind}`);
  }

  if (!["UPLOADED", "READY"].includes(asset.uploadStatus)) {
    throw new ApiError(400, "Media asset is not ready to attach");
  }
};

const getNextLectureOrder = async (courseId) => {
  const lastLecture = await prisma.lecture.findFirst({
    where: {
      courseId,
    },
    orderBy: {
      lectureOrder: "desc",
    },
    select: {
      lectureOrder: true,
    },
  });

  return (lastLecture?.lectureOrder || 0) + 1;
};

const ensureLectureOrderAvailable = async ({ courseId, lectureOrder, excludeLectureId = null }) => {
  const existing = await prisma.lecture.findFirst({
    where: {
      courseId,
      lectureOrder,
      ...(excludeLectureId
        ? {
            NOT: {
              id: excludeLectureId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ApiError(409, "Lecture order already exists for this course");
  }
};

const ensureReorderTargetsAvailable = async ({ courseId, lectures }) => {
  const lectureIds = lectures.map((item) => item.lectureId);
  const lectureOrders = lectures.map((item) => item.lectureOrder);

  const conflictingLecture = await prisma.lecture.findFirst({
    where: {
      courseId,
      lectureOrder: {
        in: lectureOrders,
      },
      NOT: {
        id: {
          in: lectureIds,
        },
      },
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (conflictingLecture) {
    throw new ApiError(
      409,
      conflictingLecture.deletedAt
        ? "Lecture order is reserved by an archived lecture"
        : "Lecture order already exists for this course"
    );
  }
};

export const createLecture = async ({
  courseId,
  title,
  description,
  lectureOrder,
  isPreviewFree,
  status,
  audioMediaAssetId,
  videoMediaAssetId,
  durationSeconds,
}) => {
  await validateCourseExists(courseId);
  await validateMediaAsset({ mediaAssetId: audioMediaAssetId, expectedKind: "AUDIO" });
  await validateMediaAsset({ mediaAssetId: videoMediaAssetId, expectedKind: "VIDEO" });

  const finalLectureOrder = lectureOrder || (await getNextLectureOrder(courseId));

  await ensureLectureOrderAvailable({
    courseId,
    lectureOrder: finalLectureOrder,
  });

  const lecture = await prisma.lecture.create({
    data: {
      courseId,
      title: title.trim(),
      description: description || null,
      lectureOrder: finalLectureOrder,
      isPreviewFree,
      status,
      audioMediaAssetId: audioMediaAssetId || null,
      videoMediaAssetId: videoMediaAssetId || null,
      durationSeconds: durationSeconds ?? null,
    },
    include: lectureAdminInclude,
  });

  return formatLectureForResponse(lecture);
};

export const listLecturesByCourse = async ({ courseId, includeDeleted }) => {
  await validateCourseExists(courseId);

  const lectures = await prisma.lecture.findMany({
    where: {
      courseId,
      ...(includeDeleted === "true" ? {} : { deletedAt: null }),
    },
    include: lectureAdminInclude,
    orderBy: {
      lectureOrder: "asc",
    },
  });

  return lectures.map(formatLectureForResponse);
};

export const getLectureById = async (lectureId) => {
  const lecture = await prisma.lecture.findUnique({
    where: {
      id: lectureId,
    },
    include: lectureAdminInclude,
  });

  if (!lecture || lecture.deletedAt) {
    throw new ApiError(404, "Lecture not found");
  }

  return formatLectureForResponse(lecture);
};

export const updateLecture = async ({
  lectureId,
  title,
  description,
  lectureOrder,
  isPreviewFree,
  status,
  audioMediaAssetId,
  videoMediaAssetId,
  durationSeconds,
}) => {
  const existing = await getLectureById(lectureId);

  if (typeof audioMediaAssetId !== "undefined") {
    await validateMediaAsset({ mediaAssetId: audioMediaAssetId, expectedKind: "AUDIO" });
  }

  if (typeof videoMediaAssetId !== "undefined") {
    await validateMediaAsset({ mediaAssetId: videoMediaAssetId, expectedKind: "VIDEO" });
  }

  if (typeof lectureOrder !== "undefined" && lectureOrder !== existing.lectureOrder) {
    await ensureLectureOrderAvailable({
      courseId: existing.courseId,
      lectureOrder,
      excludeLectureId: lectureId,
    });
  }

  const data = {};

  if (typeof title !== "undefined") data.title = title.trim();
  if (typeof description !== "undefined") data.description = description || null;
  if (typeof lectureOrder !== "undefined") data.lectureOrder = lectureOrder;
  if (typeof isPreviewFree !== "undefined") data.isPreviewFree = isPreviewFree;
  if (typeof status !== "undefined") data.status = status;
  if (typeof audioMediaAssetId !== "undefined") {
    data.audioMediaAssetId = audioMediaAssetId || null;
  }
  if (typeof videoMediaAssetId !== "undefined") {
    data.videoMediaAssetId = videoMediaAssetId || null;
  }
  if (typeof durationSeconds !== "undefined") {
    data.durationSeconds = durationSeconds ?? null;
  }

  const lecture = await prisma.lecture.update({
    where: {
      id: lectureId,
    },
    data,
    include: lectureAdminInclude,
  });

  return formatLectureForResponse(lecture);
};

export const softDeleteLecture = async (lectureId) => {
  const lecture = await getLectureById(lectureId);
  const archivedLectureOrder = await getNextLectureOrder(lecture.courseId);

  const archivedLecture = await prisma.lecture.update({
    where: {
      id: lectureId,
    },
    data: {
      lectureOrder: archivedLectureOrder,
      status: "ARCHIVED",
      deletedAt: new Date(),
    },
    include: lectureAdminInclude,
  });

  return formatLectureForResponse(archivedLecture);
};

export const reorderLectures = async ({ courseId, lectures }) => {
  await validateCourseExists(courseId);

  if (lectures.length === 0) {
    return listLecturesByCourse({
      courseId,
      includeDeleted: "false",
    });
  }

  const uniqueLectureIds = [...new Set(lectures.map((item) => item.lectureId))];
  const uniqueOrders = [...new Set(lectures.map((item) => item.lectureOrder))];

  if (uniqueLectureIds.length !== lectures.length) {
    throw new ApiError(400, "Duplicate lectureId values are not allowed");
  }

  if (uniqueOrders.length !== lectures.length) {
    throw new ApiError(400, "Duplicate lectureOrder values are not allowed");
  }

  const existingLectures = await prisma.lecture.findMany({
    where: {
      courseId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  const existingLectureIdSet = new Set(existingLectures.map((lecture) => lecture.id));

  for (const item of lectures) {
    if (!existingLectureIdSet.has(item.lectureId)) {
      throw new ApiError(400, "One or more lectureIds do not belong to this course");
    }
  }

  await ensureReorderTargetsAvailable({
    courseId,
    lectures,
  });

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      lectures.map((item, index) =>
        tx.lecture.update({
          where: {
            id: item.lectureId,
          },
          data: {
            lectureOrder: -(index + 1),
          },
        })
      )
    );

    await Promise.all(
      lectures.map((item) =>
        tx.lecture.update({
          where: {
            id: item.lectureId,
          },
          data: {
            lectureOrder: item.lectureOrder,
          },
        })
      )
    );
  });

  return listLecturesByCourse({
    courseId,
    includeDeleted: "false",
  });
};
