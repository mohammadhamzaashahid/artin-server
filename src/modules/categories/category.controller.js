import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  listPublicCategories,
  updateCategory,
} from "./category.service.js";

export const createCategoryByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const category = await createCategory(body);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "Category",
    entityId: category.id,
    newValue: category,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { category }, "Category created successfully"));
});

export const listCategoriesByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listCategories(query);

  return res.status(200).json(new ApiResponse(200, result, "Categories fetched successfully"));
});

export const getCategoryByAdmin = asyncHandler(async (req, res) => {
  const { categoryId } = req.validated.params;

  const category = await getCategoryById(categoryId);

  return res.status(200).json(new ApiResponse(200, { category }, "Category fetched successfully"));
});

export const updateCategoryByAdmin = asyncHandler(async (req, res) => {
  const { categoryId } = req.validated.params;
  const { body } = req.validated;

  const oldCategory = await getCategoryById(categoryId);
  const category = await updateCategory({ categoryId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "Category",
    entityId: category.id,
    oldValue: oldCategory,
    newValue: category,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { category }, "Category updated successfully"));
});

export const deleteCategoryByAdmin = asyncHandler(async (req, res) => {
  const { categoryId } = req.validated.params;

  const oldCategory = await getCategoryById(categoryId);
  const result = await deleteCategory(categoryId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "Category",
    entityId: categoryId,
    oldValue: oldCategory,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, result, "Category deleted successfully"));
});

export const listCategoriesPublic = asyncHandler(async (req, res) => {
  const categories = await listPublicCategories();

  return res.status(200).json(new ApiResponse(200, { categories }, "Categories fetched successfully"));
});