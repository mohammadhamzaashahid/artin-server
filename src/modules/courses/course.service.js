import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { buildUniqueSlug, slugify } from "../../utils/slug.js";
import { buildLectureAccessView, getCourseAccessForUser } from "../access/access.service.js";
import {
  formatMediaAssetForResponse,
  formatMediaAssetWithPreviewForResponse,
} from "../media/media.service.js";

const courseAdminInclude = {
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
  prices: {
    orderBy: {
      createdAt: "desc",
    },
  },
  lectures: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      lectureOrder: "asc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      lectureOrder: true,
      isPreviewFree: true,
      status: true,
      durationSeconds: true,
      audioMediaAssetId: true,
      videoMediaAssetId: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  thumbnailImageAsset: {
    select: {
      id: true,
      objectKey: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      publicUrl: true,
      mediaKind: true,
      uploadStatus: true,
      createdAt: true,
    },
  },
  bannerImageAsset: {
    select: {
      id: true,
      objectKey: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      publicUrl: true,
      mediaKind: true,
      uploadStatus: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      lectures: true,
      purchases: true,
      subscriptions: true,
    },
  },
};

const coursePublicSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  shortDescription: true,
  description: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: true,
  tags: {
    include: {
      tag: true,
    },
  },
  prices: {
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      priceType: true,
      amount: true,
      currency: true,
      billingInterval: true,
      isActive: true,
      stripePriceId: true,
    },
  },
  thumbnailImageAsset: {
    select: {
      id: true,
      objectKey: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      publicUrl: true,
      mediaKind: true,
      uploadStatus: true,
      createdAt: true,
    },
  },
  bannerImageAsset: {
    select: {
      id: true,
      objectKey: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      durationSeconds: true,
      publicUrl: true,
      mediaKind: true,
      uploadStatus: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      lectures: {
        where: {
          status: "PUBLISHED",
          deletedAt: null,
        },
      },
    },
  },
};

const formatCourseForResponse = (course) => {
  if (!course) return course;

  return {
    ...course,
    thumbnailImageAsset: formatMediaAssetForResponse(course.thumbnailImageAsset),
    bannerImageAsset: formatMediaAssetForResponse(course.bannerImageAsset),
  };
};

const formatPublicCourseForResponse = async (course) => {
  if (!course) return course;

  return {
    ...course,
    thumbnailImageAsset: await formatMediaAssetWithPreviewForResponse(
      course.thumbnailImageAsset
    ),
    bannerImageAsset: await formatMediaAssetWithPreviewForResponse(
      course.bannerImageAsset
    ),
  };
};

const validateCategory = async (categoryId) => {
  if (!categoryId) return;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new ApiError(400, "Invalid categoryId");
  }
};

const validateTags = async (tagIds = []) => {
  if (!tagIds.length) return;

  const uniqueTagIds = [...new Set(tagIds)];

  const count = await prisma.tag.count({
    where: {
      id: {
        in: uniqueTagIds,
      },
    },
  });

  if (count !== uniqueTagIds.length) {
    throw new ApiError(400, "One or more tagIds are invalid");
  }
};

const validateMediaAsset = async ({ mediaAssetId, expectedKind }) => {
  if (!mediaAssetId) return;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    select: {
      id: true,
      mediaKind: true,
    },
  });

  if (!asset) {
    throw new ApiError(400, "Invalid media asset ID");
  }

  if (asset.mediaKind !== expectedKind) {
    throw new ApiError(400, `Media asset must be of type ${expectedKind}`);
  }
};

export const createCourse = async ({
  adminUserId,
  title,
  slug,
  subtitle,
  shortDescription,
  description,
  categoryId,
  tagIds,
  thumbnailImageAssetId,
  bannerImageAssetId,
}) => {
  await validateCategory(categoryId);
  await validateTags(tagIds);
  await validateMediaAsset({ mediaAssetId: thumbnailImageAssetId, expectedKind: "IMAGE" });
  await validateMediaAsset({ mediaAssetId: bannerImageAssetId, expectedKind: "IMAGE" });

  const finalSlug =
    slug ||
    (await buildUniqueSlug({
      baseText: title,
      findExistingBySlug: async (candidate) => {
        return prisma.course.findUnique({
          where: { slug: candidate },
          select: { id: true },
        });
      },
    }));

  const cleanSlug = slugify(finalSlug);

  const slugExists = await prisma.course.findUnique({
    where: { slug: cleanSlug },
    select: { id: true },
  });

  if (slugExists) {
    throw new ApiError(409, "Course slug already exists");
  }

  const uniqueTagIds = [...new Set(tagIds || [])];

  const course = await prisma.course.create({
    data: {
      title: title.trim(),
      slug: cleanSlug,
      subtitle: subtitle || null,
      shortDescription: shortDescription || null,
      description: description || null,
      categoryId: categoryId || null,
      thumbnailImageAssetId: thumbnailImageAssetId || null,
      bannerImageAssetId: bannerImageAssetId || null,
      createdByAdminId: adminUserId,
      tags: {
        create: uniqueTagIds.map((tagId) => ({
          tagId,
        })),
      },
    },
    include: courseAdminInclude,
  });

  return formatCourseForResponse(course);
};

export const listAdminCourses = async ({
  page,
  limit,
  search,
  status,
  categoryId,
  includeDeleted,
}) => {
  const pagination = getPagination({ page, limit });

  const where = {
    ...(includeDeleted === "true" ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { subtitle: { contains: search, mode: "insensitive" } },
            { shortDescription: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      include: courseAdminInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    items: await Promise.all(items.map(formatPublicCourseForResponse)),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getAdminCourseById = async (courseId) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: courseAdminInclude,
  });

  if (!course || course.deletedAt) {
    throw new ApiError(404, "Course not found");
  }

  return formatCourseForResponse(course);
};

export const updateCourse = async ({
  courseId,
  title,
  slug,
  subtitle,
  shortDescription,
  description,
  categoryId,
  tagIds,
  thumbnailImageAssetId,
  bannerImageAssetId,
  status,
}) => {
  const existing = await getAdminCourseById(courseId);

  if (typeof categoryId !== "undefined") {
    await validateCategory(categoryId);
  }

  if (typeof tagIds !== "undefined") {
    await validateTags(tagIds);
  }

  if (typeof thumbnailImageAssetId !== "undefined") {
    await validateMediaAsset({ mediaAssetId: thumbnailImageAssetId, expectedKind: "IMAGE" });
  }

  if (typeof bannerImageAssetId !== "undefined") {
    await validateMediaAsset({ mediaAssetId: bannerImageAssetId, expectedKind: "IMAGE" });
  }

  const data = {};

  if (typeof title !== "undefined") data.title = title.trim();
  if (typeof subtitle !== "undefined") data.subtitle = subtitle || null;
  if (typeof shortDescription !== "undefined") data.shortDescription = shortDescription || null;
  if (typeof description !== "undefined") data.description = description || null;
  if (typeof categoryId !== "undefined") data.categoryId = categoryId || null;

  if (typeof thumbnailImageAssetId !== "undefined") {
    data.thumbnailImageAssetId = thumbnailImageAssetId || null;
  }

  if (typeof bannerImageAssetId !== "undefined") {
    data.bannerImageAssetId = bannerImageAssetId || null;
  }

  if (typeof status !== "undefined") {
    data.status = status;

    if (status === "PUBLISHED" && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  if (typeof slug !== "undefined") {
    const cleanSlug = slugify(slug);

    const slugExists = await prisma.course.findFirst({
      where: {
        slug: cleanSlug,
        NOT: {
          id: courseId,
        },
      },
      select: { id: true },
    });

    if (slugExists) {
      throw new ApiError(409, "Course slug already exists");
    }

    data.slug = cleanSlug;
  }

  return prisma.$transaction(async (tx) => {
    if (typeof tagIds !== "undefined") {
      await tx.courseTag.deleteMany({
        where: { courseId },
      });

      const uniqueTagIds = [...new Set(tagIds)];

      if (uniqueTagIds.length > 0) {
        await tx.courseTag.createMany({
          data: uniqueTagIds.map((tagId) => ({
            courseId,
            tagId,
          })),
        });
      }
    }

    const course = await tx.course.update({
      where: { id: courseId },
      data,
      include: courseAdminInclude,
    });

    return formatCourseForResponse(course);
  });
};

export const softDeleteCourse = async (courseId) => {
  await getAdminCourseById(courseId);

  const course = await prisma.course.update({
    where: { id: courseId },
    data: {
      status: "ARCHIVED",
      deletedAt: new Date(),
    },
    include: courseAdminInclude,
  });

  return formatCourseForResponse(course);
};

export const publishCourse = async (courseId) => {
  const course = await getAdminCourseById(courseId);

  const activePriceCount = await prisma.coursePrice.count({
    where: {
      courseId,
      isActive: true,
    },
  });

  if (activePriceCount === 0) {
    throw new ApiError(400, "Add at least one active course price before publishing");
  }

  const updatedCourse = await prisma.course.update({
    where: { id: course.id },
    data: {
      status: "PUBLISHED",
      publishedAt: course.publishedAt || new Date(),
    },
    include: courseAdminInclude,
  });

  return formatCourseForResponse(updatedCourse);
};

export const unpublishCourse = async (courseId) => {
  const course = await getAdminCourseById(courseId);

  const updatedCourse = await prisma.course.update({
    where: { id: course.id },
    data: {
      status: "DRAFT",
    },
    include: courseAdminInclude,
  });

  return formatCourseForResponse(updatedCourse);
};

export const listPublicCourses = async ({ page, limit, search, category, tag }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    status: "PUBLISHED",
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { subtitle: { contains: search, mode: "insensitive" } },
            { shortDescription: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(category
      ? {
          category: {
            slug: category,
          },
        }
      : {}),
    ...(tag
      ? {
          tags: {
            some: {
              tag: {
                slug: tag,
              },
            },
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      select: coursePublicSelect,
      orderBy: {
        publishedAt: "desc",
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    items: await Promise.all(items.map(formatPublicCourseForResponse)),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getPublicCourseBySlug = async ({ slug, userId = null }) => {
  const course = await prisma.course.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      deletedAt: null,
    },
    select: {
      ...coursePublicSelect,
      lectures: {
        where: {
          status: "PUBLISHED",
          deletedAt: null,
        },
        orderBy: {
          lectureOrder: "asc",
        },
        select: {
          id: true,
          title: true,
          description: true,
          lectureOrder: true,
          isPreviewFree: true,
          durationSeconds: true,
          status: true,
          audioMediaAssetId: true,
          videoMediaAssetId: true,
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const access = await getCourseAccessForUser({
    userId,
    courseId: course.id,
  });

  const lectures = course.lectures.map((lecture) =>
    buildLectureAccessView({
      lecture,
      courseAccess: access,
    })
  );

  const formattedCourse = await formatPublicCourseForResponse(course);

  return {
    ...formattedCourse,
    access,
    lectures,
  };
};

export const createCoursePrice = async ({
  courseId,
  priceType,
  amount,
  currency,
  billingInterval,
  stripeProductId,
  stripePriceId,
  isActive,
}) => {
  await getAdminCourseById(courseId);

  if (priceType === "SUBSCRIPTION" && !billingInterval) {
    throw new ApiError(400, "billingInterval is required for subscription prices");
  }

  if (priceType === "ONE_TIME" && billingInterval) {
    throw new ApiError(400, "billingInterval must be empty for one-time prices");
  }

  if (stripePriceId) {
    const existingStripePrice = await prisma.coursePrice.findUnique({
      where: {
        stripePriceId,
      },
      select: {
        id: true,
      },
    });

    if (existingStripePrice) {
      throw new ApiError(409, "Stripe price ID already exists");
    }
  }

  return prisma.coursePrice.create({
    data: {
      courseId,
      priceType,
      amount,
      currency: currency.toUpperCase(),
      billingInterval: priceType === "SUBSCRIPTION" ? billingInterval : null,
      stripeProductId: stripeProductId || null,
      stripePriceId: stripePriceId || null,
      isActive,
    },
  });
};

export const listCoursePrices = async (courseId) => {
  await getAdminCourseById(courseId);

  return prisma.coursePrice.findMany({
    where: {
      courseId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const updateCoursePrice = async ({
  priceId,
  amount,
  currency,
  billingInterval,
  stripeProductId,
  stripePriceId,
  isActive,
}) => {
  const existing = await prisma.coursePrice.findUnique({
    where: { id: priceId },
  });

  if (!existing) {
    throw new ApiError(404, "Course price not found");
  }

  if (existing.priceType === "SUBSCRIPTION" && billingInterval === null) {
    throw new ApiError(400, "billingInterval is required for subscription prices");
  }

  if (existing.priceType === "ONE_TIME" && billingInterval) {
    throw new ApiError(400, "billingInterval must be empty for one-time prices");
  }

  if (stripePriceId) {
    const existingStripePrice = await prisma.coursePrice.findFirst({
      where: {
        stripePriceId,
        NOT: {
          id: priceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingStripePrice) {
      throw new ApiError(409, "Stripe price ID already exists");
    }
  }

  const data = {};

  if (typeof amount !== "undefined") data.amount = amount;
  if (typeof currency !== "undefined") data.currency = currency.toUpperCase();
  if (typeof billingInterval !== "undefined") data.billingInterval = billingInterval;
  if (typeof stripeProductId !== "undefined") data.stripeProductId = stripeProductId || null;
  if (typeof stripePriceId !== "undefined") data.stripePriceId = stripePriceId || null;
  if (typeof isActive !== "undefined") data.isActive = isActive;

  return prisma.coursePrice.update({
    where: { id: priceId },
    data,
  });
};

export const deactivateCoursePrice = async (priceId) => {
  const existing = await prisma.coursePrice.findUnique({
    where: { id: priceId },
  });

  if (!existing) {
    throw new ApiError(404, "Course price not found");
  }

  return prisma.coursePrice.update({
    where: { id: priceId },
    data: {
      isActive: false,
    },
  });
};
