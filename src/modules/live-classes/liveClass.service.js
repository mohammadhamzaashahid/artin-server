import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { buildUniqueSlug, slugify } from "../../utils/slug.js";
import {
  formatMediaAssetForResponse,
  formatMediaAssetWithPreviewForResponse,
} from "../media/media.service.js";
import { getLiveClassAccessForUser } from "../access/access.service.js";

const mediaAssetSelect = {
  id: true,
  provider: true,
  objectKey: true,
  originalFilename: true,
  mimeType: true,
  fileSizeBytes: true,
  durationSeconds: true,
  publicUrl: true,
  mediaKind: true,
  uploadStatus: true,
  createdAt: true,
};

const liveClassAdminInclude = {
  course: {
    select: { id: true, title: true, slug: true },
  },
  prices: {
    orderBy: { createdAt: "desc" },
  },
  bannerImageAsset: { select: mediaAssetSelect },
  materials: {
    orderBy: { displayOrder: "asc" },
    include: { mediaAsset: { select: mediaAssetSelect } },
  },
  _count: {
    select: { purchases: true },
  },
};

const liveClassPublicSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  timeDuration: true,
  status: true,
  publishedAt: true,
  courseId: true,
  createdAt: true,
  updatedAt: true,
  course: {
    select: { id: true, title: true, slug: true },
  },
  prices: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amount: true,
      currency: true,
      isActive: true,
      stripePriceId: true,
    },
  },
  bannerImageAsset: { select: mediaAssetSelect },
  materials: {
    orderBy: { displayOrder: "asc" },
    include: { mediaAsset: { select: mediaAssetSelect } },
  },
};

const formatMaterialsForResponse = (materials = []) =>
  materials.map((m) => ({
    id: m.id,
    displayOrder: m.displayOrder,
    mediaAsset: formatMediaAssetForResponse(m.mediaAsset),
  }));

const formatLiveClassForResponse = (liveClass) => {
  if (!liveClass) return liveClass;

  return {
    ...liveClass,
    bannerImageAsset: formatMediaAssetForResponse(liveClass.bannerImageAsset),
    materials: formatMaterialsForResponse(liveClass.materials),
  };
};

const formatPublicLiveClassForResponse = async (liveClass) => {
  if (!liveClass) return liveClass;

  return {
    ...liveClass,
    bannerImageAsset: await formatMediaAssetWithPreviewForResponse(liveClass.bannerImageAsset),
    materials: formatMaterialsForResponse(liveClass.materials),
  };
};

const validateMediaAsset = async ({ mediaAssetId, expectedKind }) => {
  if (!mediaAssetId) return;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    select: { id: true, mediaKind: true },
  });

  if (!asset) {
    throw new ApiError(400, "Invalid media asset ID");
  }

  if (asset.mediaKind !== expectedKind) {
    throw new ApiError(400, `Media asset must be of type ${expectedKind}`);
  }
};

const validatePreparatoryMaterialIds = async (materialIds = []) => {
  if (!materialIds.length) return;

  const uniqueIds = [...new Set(materialIds)];

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (assets.length !== uniqueIds.length) {
    throw new ApiError(400, "One or more preparatory material asset IDs are invalid");
  }
};

const validateCourse = async (courseId) => {
  if (!courseId) return;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });

  if (!course) {
    throw new ApiError(400, "Invalid courseId — course not found");
  }
};

export const getAdminLiveClassById = async (liveClassId) => {
  const liveClass = await prisma.liveClass.findUnique({
    where: { id: liveClassId },
    include: liveClassAdminInclude,
  });

  if (!liveClass || liveClass.deletedAt) {
    throw new ApiError(404, "Live class not found");
  }

  return formatLiveClassForResponse(liveClass);
};

export const createLiveClass = async ({
  adminUserId,
  title,
  slug,
  description,
  startDate,
  endDate,
  timeDuration,
  joiningLink,
  bannerImageAssetId,
  preparatoryMaterialIds,
  courseId,
}) => {
  if (new Date(endDate) <= new Date(startDate)) {
    throw new ApiError(400, "endDate must be after startDate");
  }

  await validateMediaAsset({ mediaAssetId: bannerImageAssetId, expectedKind: "IMAGE" });
  await validatePreparatoryMaterialIds(preparatoryMaterialIds);
  await validateCourse(courseId);

  const finalSlug =
    slug ||
    (await buildUniqueSlug({
      baseText: title,
      findExistingBySlug: async (candidate) =>
        prisma.liveClass.findUnique({ where: { slug: candidate }, select: { id: true } }),
    }));

  const cleanSlug = slugify(finalSlug);

  const slugExists = await prisma.liveClass.findUnique({
    where: { slug: cleanSlug },
    select: { id: true },
  });

  if (slugExists) {
    throw new ApiError(409, "Live class slug already exists");
  }

  const uniqueMaterialIds = [...new Set(preparatoryMaterialIds || [])];

  const liveClass = await prisma.liveClass.create({
    data: {
      title: title.trim(),
      slug: cleanSlug,
      description: description || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      timeDuration,
      joiningLink: joiningLink || null,
      bannerImageAssetId: bannerImageAssetId || null,
      courseId: courseId || null,
      createdByAdminId: adminUserId,
      materials: {
        create: uniqueMaterialIds.map((mediaAssetId, index) => ({
          mediaAssetId,
          displayOrder: index,
        })),
      },
    },
    include: liveClassAdminInclude,
  });

  return formatLiveClassForResponse(liveClass);
};

export const listAdminLiveClasses = async ({
  page,
  limit,
  search,
  status,
  courseId,
  includeDeleted,
}) => {
  const pagination = getPagination({ page, limit });

  const where = {
    ...(includeDeleted === "true" ? {} : { deletedAt: null }),
    ...(status ? { status } : {}),
    ...(courseId ? { courseId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.liveClass.findMany({
      where,
      include: liveClassAdminInclude,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.liveClass.count({ where }),
  ]);

  return {
    items: items.map(formatLiveClassForResponse),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const updateLiveClass = async ({
  liveClassId,
  title,
  slug,
  description,
  startDate,
  endDate,
  timeDuration,
  joiningLink,
  bannerImageAssetId,
  preparatoryMaterialIds,
  courseId,
  status,
}) => {
  const existing = await getAdminLiveClassById(liveClassId);

  const resolvedStart = startDate ? new Date(startDate) : existing.startDate;
  const resolvedEnd = endDate ? new Date(endDate) : existing.endDate;

  if (resolvedEnd <= resolvedStart) {
    throw new ApiError(400, "endDate must be after startDate");
  }

  if (typeof bannerImageAssetId !== "undefined") {
    await validateMediaAsset({ mediaAssetId: bannerImageAssetId, expectedKind: "IMAGE" });
  }

  if (typeof preparatoryMaterialIds !== "undefined") {
    await validatePreparatoryMaterialIds(preparatoryMaterialIds);
  }

  if (typeof courseId !== "undefined") {
    await validateCourse(courseId);
  }

  const data = {};

  if (typeof title !== "undefined") data.title = title.trim();
  if (typeof description !== "undefined") data.description = description || null;
  if (typeof startDate !== "undefined") data.startDate = new Date(startDate);
  if (typeof endDate !== "undefined") data.endDate = new Date(endDate);
  if (typeof timeDuration !== "undefined") data.timeDuration = timeDuration;
  if (typeof joiningLink !== "undefined") data.joiningLink = joiningLink || null;
  if (typeof bannerImageAssetId !== "undefined") data.bannerImageAssetId = bannerImageAssetId || null;
  if (typeof courseId !== "undefined") data.courseId = courseId || null;

  if (typeof status !== "undefined") {
    data.status = status;

    if (status === "PUBLISHED" && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  if (typeof slug !== "undefined") {
    const cleanSlug = slugify(slug);

    const slugExists = await prisma.liveClass.findFirst({
      where: { slug: cleanSlug, NOT: { id: liveClassId } },
      select: { id: true },
    });

    if (slugExists) {
      throw new ApiError(409, "Live class slug already exists");
    }

    data.slug = cleanSlug;
  }

  return prisma.$transaction(async (tx) => {
    if (typeof preparatoryMaterialIds !== "undefined") {
      await tx.liveClassMaterial.deleteMany({ where: { liveClassId } });

      const uniqueIds = [...new Set(preparatoryMaterialIds)];

      if (uniqueIds.length > 0) {
        await tx.liveClassMaterial.createMany({
          data: uniqueIds.map((mediaAssetId, index) => ({
            liveClassId,
            mediaAssetId,
            displayOrder: index,
          })),
        });
      }
    }

    const liveClass = await tx.liveClass.update({
      where: { id: liveClassId },
      data,
      include: liveClassAdminInclude,
    });

    return formatLiveClassForResponse(liveClass);
  });
};

export const softDeleteLiveClass = async (liveClassId) => {
  await getAdminLiveClassById(liveClassId);

  const liveClass = await prisma.liveClass.update({
    where: { id: liveClassId },
    data: {
      status: "ARCHIVED",
      deletedAt: new Date(),
    },
    include: liveClassAdminInclude,
  });

  return formatLiveClassForResponse(liveClass);
};

export const publishLiveClass = async (liveClassId) => {
  const liveClass = await getAdminLiveClassById(liveClassId);

  const activePriceCount = await prisma.liveClassPrice.count({
    where: { liveClassId, isActive: true },
  });

  if (activePriceCount === 0) {
    throw new ApiError(400, "Add at least one active price before publishing");
  }

  const updated = await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: {
      status: "PUBLISHED",
      publishedAt: liveClass.publishedAt || new Date(),
    },
    include: liveClassAdminInclude,
  });

  return formatLiveClassForResponse(updated);
};

export const unpublishLiveClass = async (liveClassId) => {
  const liveClass = await getAdminLiveClassById(liveClassId);

  const updated = await prisma.liveClass.update({
    where: { id: liveClass.id },
    data: { status: "DRAFT" },
    include: liveClassAdminInclude,
  });

  return formatLiveClassForResponse(updated);
};

// ─── Prices ──────────────────────────────────────────────────────────────────

export const createLiveClassPrice = async ({
  liveClassId,
  amount,
  currency,
  stripeProductId,
  stripePriceId,
  isActive,
}) => {
  await getAdminLiveClassById(liveClassId);

  if (stripePriceId) {
    const existing = await prisma.liveClassPrice.findUnique({
      where: { stripePriceId },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, "Stripe price ID already in use");
    }
  }

  return prisma.liveClassPrice.create({
    data: {
      liveClassId,
      amount,
      currency: currency.toUpperCase(),
      stripeProductId: stripeProductId || null,
      stripePriceId: stripePriceId || null,
      isActive,
    },
  });
};

export const listLiveClassPrices = async (liveClassId) => {
  await getAdminLiveClassById(liveClassId);

  return prisma.liveClassPrice.findMany({
    where: { liveClassId },
    orderBy: { createdAt: "desc" },
  });
};

export const getLiveClassPriceById = async (priceId) => {
  const price = await prisma.liveClassPrice.findUnique({ where: { id: priceId } });

  if (!price) {
    throw new ApiError(404, "Live class price not found");
  }

  return price;
};

export const updateLiveClassPrice = async ({
  priceId,
  amount,
  currency,
  stripeProductId,
  stripePriceId,
  isActive,
}) => {
  await getLiveClassPriceById(priceId);

  if (stripePriceId) {
    const conflict = await prisma.liveClassPrice.findFirst({
      where: { stripePriceId, NOT: { id: priceId } },
      select: { id: true },
    });

    if (conflict) {
      throw new ApiError(409, "Stripe price ID already in use");
    }
  }

  const data = {};

  if (typeof amount !== "undefined") data.amount = amount;
  if (typeof currency !== "undefined") data.currency = currency.toUpperCase();
  if (typeof stripeProductId !== "undefined") data.stripeProductId = stripeProductId || null;
  if (typeof stripePriceId !== "undefined") data.stripePriceId = stripePriceId || null;
  if (typeof isActive !== "undefined") data.isActive = isActive;

  return prisma.liveClassPrice.update({ where: { id: priceId }, data });
};

export const deactivateLiveClassPrice = async (priceId) => {
  await getLiveClassPriceById(priceId);

  return prisma.liveClassPrice.update({
    where: { id: priceId },
    data: { isActive: false },
  });
};

// ─── Public ───────────────────────────────────────────────────────────────────

export const listPublicLiveClasses = async ({ page, limit, search, courseId }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    status: "PUBLISHED",
    deletedAt: null,
    ...(courseId ? { courseId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.liveClass.findMany({
      where,
      select: liveClassPublicSelect,
      orderBy: { startDate: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.liveClass.count({ where }),
  ]);

  return {
    items: await Promise.all(items.map(formatPublicLiveClassForResponse)),
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getPublicLiveClassBySlug = async ({ slug, userId = null }) => {
  const liveClass = await prisma.liveClass.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: liveClassPublicSelect,
  });

  if (!liveClass) {
    throw new ApiError(404, "Live class not found");
  }

  const access = await getLiveClassAccessForUser({ userId, liveClassId: liveClass.id });

  const formatted = await formatPublicLiveClassForResponse(liveClass);

  return {
    ...formatted,
    joiningLink: access.hasAccess ? liveClass.joiningLink : null,
    access,
  };
};
