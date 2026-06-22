import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { buildUniqueSlug } from "../../utils/slug.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { formatMediaAssetForResponse } from "../media/media.service.js";
import { buildAudioFileAccessView, getBookAccessForUser } from "./book-access.service.js";

// ─── Include helpers ──────────────────────────────────────────────────────────

const coverImageSelect = {
  id: true,
  displayOrder: true,
  createdAt: true,
  mediaAsset: {
    select: {
      id: true,
      provider: true,
      objectKey: true,
      publicUrl: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      mediaKind: true,
      uploadStatus: true,
    },
  },
};

const audioFileAdminSelect = {
  id: true,
  bookId: true,
  title: true,
  description: true,
  audioOrder: true,
  isPreviewFree: true,
  status: true,
  durationSeconds: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
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

const bookAdminInclude = {
  coverImages: {
    orderBy: { displayOrder: "asc" },
    select: coverImageSelect,
  },
  audioFiles: {
    where: { deletedAt: null },
    orderBy: { audioOrder: "asc" },
    select: audioFileAdminSelect,
  },
  createdByAdmin: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  _count: {
    select: {
      orders: true,
    },
  },
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatCoverImage = (coverImage) => {
  if (!coverImage) return null;
  return {
    ...coverImage,
    mediaAsset: formatMediaAssetForResponse(coverImage.mediaAsset),
  };
};

const formatAudioFileForResponse = (audioFile) => {
  if (!audioFile) return null;
  return {
    ...audioFile,
    audioMediaAsset: formatMediaAssetForResponse(audioFile.audioMediaAsset),
  };
};

export const formatBookForResponse = (book) => {
  if (!book) return null;
  return {
    ...book,
    coverImages: book.coverImages?.map(formatCoverImage) ?? [],
    audioFiles: book.audioFiles?.map(formatAudioFileForResponse) ?? [],
  };
};

// ─── Slug helpers ─────────────────────────────────────────────────────────────

const ensureBookSlugUnique = async (slug, excludeBookId = null) => {
  const existing = await prisma.book.findFirst({
    where: {
      slug,
      ...(excludeBookId ? { NOT: { id: excludeBookId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "Book slug is already in use");
  }

  return slug;
};

// ─── Existence check ──────────────────────────────────────────────────────────

export const validateBookExists = async (bookId, { allowDeleted = false } = {}) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true, deletedAt: true },
  });

  if (!book || (!allowDeleted && book.deletedAt)) {
    throw new ApiError(404, "Book not found");
  }

  return book;
};

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export const createBook = async ({ adminUserId, title, slug, description, price, currency }) => {
  const finalSlug = slug
    ? await ensureBookSlugUnique(slug)
    : await buildUniqueSlug({
        baseText: title,
        findExistingBySlug: (s) => prisma.book.findUnique({ where: { slug: s }, select: { id: true } }),
      });

  const book = await prisma.book.create({
    data: {
      slug: finalSlug,
      title: title.trim(),
      description: description || null,
      price: price ?? 0,
      currency: currency || "USD",
      createdByAdminId: adminUserId,
    },
    include: bookAdminInclude,
  });

  return formatBookForResponse(book);
};

export const listAdminBooks = async ({ page, limit, search, status, includeDeleted }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    ...(status ? { status } : {}),
    ...(includeDeleted === "true" ? {} : { deletedAt: null }),
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
    prisma.book.findMany({
      where,
      include: {
        coverImages: {
          take: 1,
          orderBy: { displayOrder: "asc" },
          select: coverImageSelect,
        },
        _count: {
          select: {
            audioFiles: { where: { deletedAt: null } },
            orders: true,
          },
        },
        createdByAdmin: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.book.count({ where }),
  ]);

  return {
    items: items.map((book) => ({
      ...book,
      coverImages: book.coverImages.map(formatCoverImage),
    })),
    pagination: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
};

export const getAdminBookById = async (bookId) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: bookAdminInclude,
  });

  if (!book || book.deletedAt) {
    throw new ApiError(404, "Book not found");
  }

  return formatBookForResponse(book);
};

export const updateBook = async ({
  bookId,
  title,
  slug,
  description,
  price,
  currency,
  status,
}) => {
  const existing = await getAdminBookById(bookId);

  if (slug && slug !== existing.slug) {
    await ensureBookSlugUnique(slug, bookId);
  }

  const data = {};
  if (typeof title !== "undefined") data.title = title.trim();
  if (typeof slug !== "undefined") data.slug = slug;
  if (typeof description !== "undefined") data.description = description || null;
  if (typeof price !== "undefined") data.price = price;
  if (typeof currency !== "undefined") data.currency = currency;
  if (typeof status !== "undefined") data.status = status;

  const book = await prisma.book.update({
    where: { id: bookId },
    data,
    include: bookAdminInclude,
  });

  return formatBookForResponse(book);
};

export const publishBook = async (bookId) => {
  await getAdminBookById(bookId);

  const book = await prisma.book.update({
    where: { id: bookId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    include: bookAdminInclude,
  });

  return formatBookForResponse(book);
};

export const unpublishBook = async (bookId) => {
  await getAdminBookById(bookId);

  const book = await prisma.book.update({
    where: { id: bookId },
    data: { status: "DRAFT" },
    include: bookAdminInclude,
  });

  return formatBookForResponse(book);
};

export const softDeleteBook = async (bookId) => {
  await getAdminBookById(bookId);

  const book = await prisma.book.update({
    where: { id: bookId },
    data: {
      status: "ARCHIVED",
      deletedAt: new Date(),
    },
    include: bookAdminInclude,
  });

  return formatBookForResponse(book);
};

// ─── Cover images ─────────────────────────────────────────────────────────────

const validateImageAsset = async (mediaAssetId) => {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    select: { id: true, mediaKind: true, uploadStatus: true },
  });

  if (!asset) throw new ApiError(400, "Media asset not found");
  if (asset.mediaKind !== "IMAGE") throw new ApiError(400, "Media asset must be an IMAGE");
  if (!["UPLOADED", "READY"].includes(asset.uploadStatus)) {
    throw new ApiError(400, "Media asset is not ready to attach");
  }
};

export const addCoverImage = async ({ bookId, mediaAssetId, displayOrder }) => {
  await validateBookExists(bookId);
  await validateImageAsset(mediaAssetId);

  const existing = await prisma.bookCoverImage.findUnique({
    where: { bookId_mediaAssetId: { bookId, mediaAssetId } },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "This image is already attached to the book");
  }

  const coverImage = await prisma.bookCoverImage.create({
    data: { bookId, mediaAssetId, displayOrder: displayOrder ?? 0 },
    select: coverImageSelect,
  });

  return formatCoverImage(coverImage);
};

export const listCoverImages = async (bookId) => {
  await validateBookExists(bookId);

  const images = await prisma.bookCoverImage.findMany({
    where: { bookId },
    orderBy: { displayOrder: "asc" },
    select: coverImageSelect,
  });

  return images.map(formatCoverImage);
};

export const removeCoverImage = async ({ bookId, coverImageId }) => {
  await validateBookExists(bookId);

  const coverImage = await prisma.bookCoverImage.findFirst({
    where: { id: coverImageId, bookId },
    select: { id: true },
  });

  if (!coverImage) {
    throw new ApiError(404, "Cover image not found on this book");
  }

  await prisma.bookCoverImage.delete({ where: { id: coverImageId } });

  return { deleted: true };
};

export const reorderCoverImages = async ({ bookId, items }) => {
  await validateBookExists(bookId);

  const ids = items.map((i) => i.coverImageId);
  const existing = await prisma.bookCoverImage.findMany({
    where: { bookId, id: { in: ids } },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    throw new ApiError(400, "One or more cover image IDs do not belong to this book");
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.bookCoverImage.update({
        where: { id: item.coverImageId },
        data: { displayOrder: item.displayOrder },
      })
    )
  );

  return listCoverImages(bookId);
};

// ─── Public listing ───────────────────────────────────────────────────────────

export const listPublicBooks = async ({ page, limit, search }) => {
  const pagination = getPagination({ page, limit: Math.min(limit, 50) });

  const where = {
    status: "PUBLISHED",
    deletedAt: null,
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
    prisma.book.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        publishedAt: true,
        createdAt: true,
        coverImages: {
          take: 1,
          orderBy: { displayOrder: "asc" },
          select: coverImageSelect,
        },
        _count: {
          select: {
            audioFiles: {
              where: { status: "PUBLISHED", deletedAt: null },
            },
          },
        },
      },
      orderBy: { publishedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.book.count({ where }),
  ]);

  return {
    items: items.map((book) => ({
      ...book,
      coverImages: book.coverImages.map(formatCoverImage),
    })),
    pagination: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
};

export const getPublicBookBySlug = async ({ slug, userId }) => {
  const book = await prisma.book.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      currency: true,
      publishedAt: true,
      createdAt: true,
      status: true,
      deletedAt: true,
      coverImages: {
        orderBy: { displayOrder: "asc" },
        select: coverImageSelect,
      },
      audioFiles: {
        where: { status: "PUBLISHED", deletedAt: null },
        orderBy: { audioOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          audioOrder: true,
          isPreviewFree: true,
          status: true,
          durationSeconds: true,
          audioMediaAsset: {
            select: {
              id: true,
              mimeType: true,
              durationSeconds: true,
              mediaKind: true,
            },
          },
        },
      },
    },
  });

  if (!book || book.deletedAt || book.status !== "PUBLISHED") {
    throw new ApiError(404, "Book not found");
  }

  const bookAccess = await getBookAccessForUser({ userId, bookId: book.id });

  const audioFilesWithAccess = book.audioFiles.map((audioFile) =>
    buildAudioFileAccessView({ audioFile, bookAccess })
  );

  return {
    ...book,
    coverImages: book.coverImages.map(formatCoverImage),
    audioFiles: audioFilesWithAccess,
    access: bookAccess,
  };
};
