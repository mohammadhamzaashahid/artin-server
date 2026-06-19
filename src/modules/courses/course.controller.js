import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  createCourse,
  createCoursePrice,
  createCourseBatch,
  deactivateCoursePrice,
  deleteCourseBatch,
  getAdminCourseById,
  getCourseBatchById,
  getPublicCourseBySlug,
  listAdminCourses,
  listCourseBatches,
  listCoursePrices,
  listPublicCourses,
  listPublicCourseBatches,
  publishCourse,
  softDeleteCourse,
  unpublishCourse,
  updateCourse,
  updateCourseBatch,
  updateCoursePrice,
} from "./course.service.js";

export const createCourseByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const course = await createCourse({
    adminUserId: req.user.id,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "Course",
    entityId: course.id,
    newValue: course,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { course }, "Course created successfully"));
});

export const listCoursesByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listAdminCourses(query);

  return res.status(200).json(new ApiResponse(200, result, "Courses fetched successfully"));
});

export const getCourseByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;

  const course = await getAdminCourseById(courseId);

  return res.status(200).json(new ApiResponse(200, { course }, "Course fetched successfully"));
});

export const updateCourseByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;
  const { body } = req.validated;

  const oldCourse = await getAdminCourseById(courseId);
  const course = await updateCourse({ courseId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "Course",
    entityId: course.id,
    oldValue: oldCourse,
    newValue: course,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { course }, "Course updated successfully"));
});

export const deleteCourseByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;

  const oldCourse = await getAdminCourseById(courseId);
  const course = await softDeleteCourse(courseId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "Course",
    entityId: course.id,
    oldValue: oldCourse,
    newValue: course,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { course }, "Course archived successfully"));
});

export const publishCourseByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;

  const oldCourse = await getAdminCourseById(courseId);
  const course = await publishCourse(courseId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "PUBLISH",
    entityType: "Course",
    entityId: course.id,
    oldValue: oldCourse,
    newValue: course,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { course }, "Course published successfully"));
});

export const unpublishCourseByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;

  const oldCourse = await getAdminCourseById(courseId);
  const course = await unpublishCourse(courseId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UNPUBLISH",
    entityType: "Course",
    entityId: course.id,
    oldValue: oldCourse,
    newValue: course,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { course }, "Course unpublished successfully"));
});

export const listCoursesPublic = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await listPublicCourses(query);

  return res.status(200).json(new ApiResponse(200, result, "Courses fetched successfully"));
});

export const getCoursePublic = asyncHandler(async (req, res) => {

  const { slug } = req.validated.params;

  const course = await getPublicCourseBySlug({

    slug,

    userId: req.user?.id || null,

  });

  return res.status(200).json(new ApiResponse(200, { course }, "Course fetched successfully"));

});

export const createCoursePriceByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;
  const { body } = req.validated;

  const price = await createCoursePrice({
    courseId,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "CoursePrice",
    entityId: price.id,
    newValue: price,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { price }, "Course price created successfully"));
});

export const listCoursePricesByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;

  const prices = await listCoursePrices(courseId);

  return res.status(200).json(new ApiResponse(200, { prices }, "Course prices fetched successfully"));
});

export const updateCoursePriceByAdmin = asyncHandler(async (req, res) => {
  const { priceId } = req.validated.params;
  const { body } = req.validated;

  const price = await updateCoursePrice({
    priceId,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "CoursePrice",
    entityId: price.id,
    newValue: price,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { price }, "Course price updated successfully"));
});

export const deleteCoursePriceByAdmin = asyncHandler(async (req, res) => {
  const { priceId } = req.validated.params;

  const price = await deactivateCoursePrice(priceId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "CoursePrice",
    entityId: price.id,
    newValue: price,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { price }, "Course price deactivated successfully"));
});

export const createCourseBatchByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;
  const { body } = req.validated;

  const batch = await createCourseBatch({ courseId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "CourseBatch",
    entityId: batch.id,
    newValue: batch,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { batch }, "Course batch created successfully"));
});

export const listCourseBatchesByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;

  const batches = await listCourseBatches(courseId);

  return res.status(200).json(new ApiResponse(200, { batches }, "Course batches fetched successfully"));
});

export const updateCourseBatchByAdmin = asyncHandler(async (req, res) => {
  const { batchId } = req.validated.params;
  const { body } = req.validated;

  const oldBatch = await getCourseBatchById(batchId);
  const batch = await updateCourseBatch({ batchId, ...body });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "CourseBatch",
    entityId: batch.id,
    oldValue: oldBatch,
    newValue: batch,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { batch }, "Course batch updated successfully"));
});

export const deleteCourseBatchByAdmin = asyncHandler(async (req, res) => {
  const { batchId } = req.validated.params;

  const oldBatch = await getCourseBatchById(batchId);
  await deleteCourseBatch(batchId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "CourseBatch",
    entityId: batchId,
    oldValue: oldBatch,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { deleted: true }, "Course batch deleted successfully"));
});

export const listCourseBatchesPublic = asyncHandler(async (req, res) => {
  const { slug } = req.validated.params;

  const batches = await listPublicCourseBatches(slug);

  return res.status(200).json(new ApiResponse(200, { batches }, "Course batches fetched successfully"));
});