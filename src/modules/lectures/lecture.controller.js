import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAdminAuditLog } from "../audit/audit.service.js";
import {
  createLecture,
  getLectureById,
  listLecturesByCourse,
  reorderLectures,
  softDeleteLecture,
  updateLecture,
} from "./lecture.service.js";

export const createLectureByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;
  const { body } = req.validated;

  const lecture = await createLecture({
    courseId,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "CREATE",
    entityType: "Lecture",
    entityId: lecture.id,
    newValue: lecture,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(201).json(new ApiResponse(201, { lecture }, "Lecture created successfully"));
});

export const listLecturesByCourseAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;
  const { query } = req.validated;

  const lectures = await listLecturesByCourse({
    courseId,
    includeDeleted: query.includeDeleted,
  });

  return res.status(200).json(new ApiResponse(200, { lectures }, "Lectures fetched successfully"));
});

export const getLectureByAdmin = asyncHandler(async (req, res) => {
  const { lectureId } = req.validated.params;

  const lecture = await getLectureById(lectureId);

  return res.status(200).json(new ApiResponse(200, { lecture }, "Lecture fetched successfully"));
});

export const updateLectureByAdmin = asyncHandler(async (req, res) => {
  const { lectureId } = req.validated.params;
  const { body } = req.validated;

  const oldLecture = await getLectureById(lectureId);
  const lecture = await updateLecture({
    lectureId,
    ...body,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "UPDATE",
    entityType: "Lecture",
    entityId: lecture.id,
    oldValue: oldLecture,
    newValue: lecture,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { lecture }, "Lecture updated successfully"));
});

export const deleteLectureByAdmin = asyncHandler(async (req, res) => {
  const { lectureId } = req.validated.params;

  const oldLecture = await getLectureById(lectureId);
  const lecture = await softDeleteLecture(lectureId);

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "DELETE",
    entityType: "Lecture",
    entityId: lecture.id,
    oldValue: oldLecture,
    newValue: lecture,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { lecture }, "Lecture archived successfully"));
});

export const reorderLecturesByAdmin = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.params;
  const { lectures } = req.validated.body;

  const result = await reorderLectures({
    courseId,
    lectures,
  });

  await createAdminAuditLog({
    adminUserId: req.user.id,
    action: "REORDER",
    entityType: "Lecture",
    entityId: courseId,
    newValue: {
      courseId,
      lectures,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  return res.status(200).json(new ApiResponse(200, { lectures: result }, "Lectures reordered successfully"));
});