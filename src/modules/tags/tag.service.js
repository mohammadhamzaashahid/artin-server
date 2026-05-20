import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { buildUniqueSlug, slugify } from "../../utils/slug.js";

export const createTag = async ({ name, slug }) => {
  const finalSlug =
    slug ||
    (await buildUniqueSlug({
      baseText: name,
      findExistingBySlug: async (candidate) => {
        return prisma.tag.findUnique({
          where: { slug: candidate },
          select: { id: true },
        });
      },
    }));

  const cleanSlug = slugify(finalSlug);

  const existingSlug = await prisma.tag.findUnique({
    where: { slug: cleanSlug },
    select: { id: true },
  });

  if (existingSlug) {
    throw new ApiError(409, "Tag slug already exists");
  }

  return prisma.tag.create({
    data: {
      name: name.trim(),
      slug: cleanSlug,
    },
  });
};

export const listTags = async ({ page, limit, search }) => {
  const pagination = getPagination({ page, limit });

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.tag.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    }),
    prisma.tag.count({ where }),
  ]);

  return {
    items,
    pagination: buildPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
};

export const getTagById = async (tagId) => {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!tag) {
    throw new ApiError(404, "Tag not found");
  }

  return tag;
};

export const updateTag = async ({ tagId, name, slug }) => {
  const existing = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!existing) {
    throw new ApiError(404, "Tag not found");
  }

  const data = {};

  if (typeof name !== "undefined") {
    data.name = name.trim();
  }

  if (typeof slug !== "undefined") {
    const cleanSlug = slugify(slug);

    const slugExists = await prisma.tag.findFirst({
      where: {
        slug: cleanSlug,
        NOT: {
          id: tagId,
        },
      },
      select: { id: true },
    });

    if (slugExists) {
      throw new ApiError(409, "Tag slug already exists");
    }

    data.slug = cleanSlug;
  }

  return prisma.tag.update({
    where: { id: tagId },
    data,
  });
};

export const deleteTag = async (tagId) => {
  const existing = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!existing) {
    throw new ApiError(404, "Tag not found");
  }

  if (existing._count.courses > 0) {
    throw new ApiError(400, "Cannot delete tag while courses are assigned to it");
  }

  await prisma.tag.delete({
    where: { id: tagId },
  });

  return {
    deleted: true,
  };
};

export const listPublicTags = async () => {
  return prisma.tag.findMany({
    where: {
      courses: {
        some: {
          course: {
            status: "PUBLISHED",
            deletedAt: null,
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });
};