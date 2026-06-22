import { prisma } from "../../config/prisma.js";

// Access is granted when the user has a confirmed order (admin started processing or beyond).
// PENDING means the order was placed but not yet confirmed by admin — no digital access yet.
// This gives the admin full control before granting access to audio content.
const GRANTED_ORDER_STATUSES = Object.freeze(["PROCESSING", "SHIPPED", "DELIVERED"]);

export const hasActiveBookPurchase = async ({ userId, bookId }) => {
  if (!userId || !bookId) return false;

  const order = await prisma.bookOrder.findFirst({
    where: {
      userId,
      bookId,
      status: { in: GRANTED_ORDER_STATUSES },
    },
    select: { id: true },
  });

  return Boolean(order);
};

export const getBookAccessForUser = async ({ userId, bookId }) => {
  if (!userId || !bookId) {
    return {
      hasAccess: false,
      reason: "AUTH_REQUIRED",
    };
  }

  const hasPurchase = await hasActiveBookPurchase({ userId, bookId });

  if (hasPurchase) {
    return {
      hasAccess: true,
      reason: "ACTIVE_PURCHASE",
    };
  }

  return {
    hasAccess: false,
    reason: "PURCHASE_REQUIRED",
  };
};

export const buildAudioFileAccessView = ({ audioFile, bookAccess }) => {
  const isPreviewFree = Boolean(audioFile.isPreviewFree);
  const hasBookAccess = Boolean(bookAccess?.hasAccess);
  const isLocked = !isPreviewFree && !hasBookAccess;

  return {
    ...audioFile,
    isLocked,
    canPlay: !isLocked,
    lockReason: isLocked ? bookAccess?.reason || "PURCHASE_REQUIRED" : null,
  };
};
