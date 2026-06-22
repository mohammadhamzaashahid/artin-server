import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  addCoverImage,
  createBook,
  getAdminBookById,
  getPublicBookBySlug,
  listAdminBooks,
  listCoverImages,
  listPublicBooks,
  publishBook,
  reorderCoverImages,
  removeCoverImage,
  softDeleteBook,
  unpublishBook,
  updateBook,
} from "./book.service.js";

// ─── Admin: Books ─────────────────────────────────────────────────────────────

export const createBookByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const book = await createBook({ adminUserId: req.user.id, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "Book",
    entityId: book.id,
    newValue: { id: book.id, title: book.title, slug: book.slug },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { book }, "Book created successfully"));
});

export const listBooksByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listAdminBooks(query);

  return res.status(200).json(new ApiResponse(200, result, "Books fetched successfully"));
});

export const getBookByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;

  const book = await getAdminBookById(bookId);

  return res.status(200).json(new ApiResponse(200, { book }, "Book fetched successfully"));
});

export const updateBookByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { body } = req.validated;

  const oldBook = await getAdminBookById(bookId);
  const book = await updateBook({ bookId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "Book",
    entityId: book.id,
    oldValue: { title: oldBook.title, slug: oldBook.slug, status: oldBook.status },
    newValue: { title: book.title, slug: book.slug, status: book.status },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { book }, "Book updated successfully"));
});

export const publishBookByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;

  const oldBook = await getAdminBookById(bookId);
  const book = await publishBook(bookId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "PUBLISH",
    entityType: "Book",
    entityId: book.id,
    oldValue: { status: oldBook.status },
    newValue: { status: book.status },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { book }, "Book published successfully"));
});

export const unpublishBookByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;

  const oldBook = await getAdminBookById(bookId);
  const book = await unpublishBook(bookId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UNPUBLISH",
    entityType: "Book",
    entityId: book.id,
    oldValue: { status: oldBook.status },
    newValue: { status: book.status },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { book }, "Book unpublished successfully"));
});

export const deleteBookByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;

  const oldBook = await getAdminBookById(bookId);
  const book = await softDeleteBook(bookId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "Book",
    entityId: book.id,
    oldValue: { title: oldBook.title, status: oldBook.status },
    newValue: { status: book.status, deletedAt: book.deletedAt },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { book }, "Book archived successfully"));
});

// ─── Admin: Cover images ──────────────────────────────────────────────────────

export const addCoverImageByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { body } = req.validated;

  const coverImage = await addCoverImage({ bookId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "Book",
    entityId: bookId,
    newValue: { action: "cover_image_added", coverImageId: coverImage.id },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { coverImage }, "Cover image added successfully"));
});

export const listCoverImagesByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;

  const coverImages = await listCoverImages(bookId);

  return res
    .status(200)
    .json(new ApiResponse(200, { coverImages }, "Cover images fetched successfully"));
});

export const removeCoverImageByAdmin = asyncHandler(async (req, res) => {
  const { bookId, coverImageId } = req.validated.params;

  const result = await removeCoverImage({ bookId, coverImageId });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "Book",
    entityId: bookId,
    newValue: { action: "cover_image_removed", coverImageId },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Cover image removed successfully"));
});

export const reorderCoverImagesByAdmin = asyncHandler(async (req, res) => {
  const { bookId } = req.validated.params;
  const { items } = req.validated.body;

  const coverImages = await reorderCoverImages({ bookId, items });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "REORDER",
    entityType: "Book",
    entityId: bookId,
    newValue: { action: "cover_images_reordered" },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { coverImages }, "Cover images reordered successfully"));
});

// ─── Public ───────────────────────────────────────────────────────────────────

export const listBooksPublic = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listPublicBooks(query);

  return res.status(200).json(new ApiResponse(200, result, "Books fetched successfully"));
});

export const getBookPublic = asyncHandler(async (req, res) => {
  const { slug } = req.validated.params;

  const book = await getPublicBookBySlug({ slug, userId: req.user?.id || null });

  return res.status(200).json(new ApiResponse(200, { book }, "Book fetched successfully"));
});
