import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { buildUniqueSlug, slugify } from "../../utils/slug.js";

export const createCategory = async ({ name, slug }) => {
  const finalSlug =
    slug ||
    (await buildUniqueSlug({
      baseText: name,
      findExistingBySlug: async (candidate) => {
        return prisma.category.findUnique({
          where: { slug: candidate },
          select: { id: true },
        });
      },
    }));

  const cleanSlug = slugify(finalSlug);

  const existingSlug = await prisma.category.findUnique({
    where: { slug: cleanSlug },
    select: { id: true },
  });

  if (existingSlug) {
    throw new ApiError(409, "Category slug already exists");
  }

  return prisma.category.create({
    data: {
      name: name.trim(),
      slug: cleanSlug,
    },
  });
};

export const listCategories = async ({ page, limit, search }) => {
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
    prisma.category.findMany({
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
    prisma.category.count({ where }),
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

export const getCategoryById = async (categoryId) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return category;
};

export const updateCategory = async ({ categoryId, name, slug }) => {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!existing) {
    throw new ApiError(404, "Category not found");
  }

  const data = {};

  if (typeof name !== "undefined") {
    data.name = name.trim();
  }

  if (typeof slug !== "undefined") {
    const cleanSlug = slugify(slug);

    const slugExists = await prisma.category.findFirst({
      where: {
        slug: cleanSlug,
        NOT: {
          id: categoryId,
        },
      },
      select: { id: true },
    });

    if (slugExists) {
      throw new ApiError(409, "Category slug already exists");
    }

    data.slug = cleanSlug;
  }

  return prisma.category.update({
    where: { id: categoryId },
    data,
  });
};

export const deleteCategory = async (categoryId) => {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!existing) {
    throw new ApiError(404, "Category not found");
  }

  if (existing._count.courses > 0) {
    throw new ApiError(400, "Cannot delete category while courses are assigned to it");
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });

  return {
    deleted: true,
  };
};

export const listPublicCategories = async () => {
  return prisma.category.findMany({
    where: {
      courses: {
        some: {
          status: "PUBLISHED",
          deletedAt: null,
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