import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import {
  adminCreateUser,
  adminDeleteUser,
  adminGetUserById,
  adminListUsers,
  adminResetUserPassword,
  adminUpdateUser,
} from "./adminUser.service.js";

export const createUserByAdmin = asyncHandler(async (req, res) => {
  const { body } = req.validated;

  const result = await adminCreateUser(body);

  return res.status(201).json(new ApiResponse(201, result, "User created successfully"));
});

export const listUsersByAdmin = asyncHandler(async (req, res) => {
  const { query } = req.validated;

  const result = await adminListUsers(query);

  return res.status(200).json(new ApiResponse(200, result, "Users fetched successfully"));
});

export const getUserByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params;

  const result = await adminGetUserById(userId);

  return res.status(200).json(new ApiResponse(200, { user: result }, "User fetched successfully"));
});

export const updateUserByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params;
  const { body } = req.validated;

  const result = await adminUpdateUser({
    actorUserId: req.user.id,
    targetUserId: userId,
    ...body,
  });

  return res.status(200).json(new ApiResponse(200, { user: result }, "User updated successfully"));
});

export const resetUserPasswordByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params;
  const { body } = req.validated;

  const result = await adminResetUserPassword({
    targetUserId: userId,
    newPassword: body.newPassword,
    sendEmail: body.sendEmail,
  });

  return res.status(200).json(new ApiResponse(200, result, "User password reset successfully"));
});

export const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.validated.params;

  const result = await adminDeleteUser({
    actorUserId: req.user.id,
    targetUserId: userId,
  });

  return res.status(200).json(new ApiResponse(200, { user: result }, "User deactivated successfully"));
});