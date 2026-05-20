import { prisma } from "../../config/prisma.js";

export const createAdminAuditLog = async ({
  adminUserId,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create admin audit log:", error.message);
  }
};