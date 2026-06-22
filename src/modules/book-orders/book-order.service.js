import { prisma } from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { buildPaginationMeta, getPagination } from "../../utils/pagination.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../emails/email.service.js";
import {
  buildBookOrderAdminNotificationTemplate,
  buildBookOrderConfirmationTemplate,
  buildBookOrderStatusUpdateTemplate,
} from "../emails/email.templates.js";

// ─── Include / format helpers ─────────────────────────────────────────────────

const bookOrderInclude = {
  user: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  book: {
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      currency: true,
      coverImages: {
        take: 1,
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          displayOrder: true,
          mediaAsset: {
            select: {
              id: true,
              provider: true,
              objectKey: true,
              publicUrl: true,
              mimeType: true,
              mediaKind: true,
            },
          },
        },
      },
    },
  },
};

// Statuses where the customer is considered a valid book purchaser.
// Kept in sync with book-access.service.js.
const TERMINAL_STATUSES = Object.freeze(["DELIVERED", "CANCELLED"]);

// ─── Place order ──────────────────────────────────────────────────────────────

export const placeBookOrder = async ({
  userId,
  bookId,
  quantity,
  deliveryName,
  deliveryEmail,
  deliveryPhone,
  deliveryAddress,
  deliveryCity,
  deliveryState,
  deliveryPostalCode,
  deliveryCountry,
  deliveryNotes,
}) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      price: true,
      currency: true,
      deletedAt: true,
    },
  });

  if (!book || book.deletedAt || book.status !== "PUBLISHED") {
    throw new ApiError(404, "Book not found or not available for purchase");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const unitPrice = Number(book.price);
  const totalAmount = unitPrice * quantity;

  const order = await prisma.bookOrder.create({
    data: {
      userId,
      bookId,
      status: "PENDING",
      quantity,
      unitPrice,
      totalAmount,
      currency: book.currency,
      deliveryName: deliveryName.trim(),
      deliveryEmail: deliveryEmail.trim().toLowerCase(),
      deliveryPhone: deliveryPhone.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryCity: deliveryCity.trim(),
      deliveryState: deliveryState?.trim() || null,
      deliveryPostalCode: deliveryPostalCode?.trim() || null,
      deliveryCountry: deliveryCountry.trim(),
      deliveryNotes: deliveryNotes?.trim() || null,
    },
    include: bookOrderInclude,
  });

  // Email notifications — best-effort: failures must not roll back the order
  const adminEmail = env.ADMIN_ORDER_EMAIL || env.SUPPORT_EMAIL;

  sendEmail({
    to: adminEmail,
    ...buildBookOrderAdminNotificationTemplate({ order, book, user }),
  }).catch((err) => console.error("[BookOrder] Failed to send admin notification:", err.message));

  sendEmail({
    to: order.deliveryEmail,
    ...buildBookOrderConfirmationTemplate({ order, book }),
  }).catch((err) =>
    console.error("[BookOrder] Failed to send order confirmation to user:", err.message)
  );

  return order;
};

// ─── Admin: update status ─────────────────────────────────────────────────────

export const updateBookOrderStatus = async ({ orderId, status, adminNotes }) => {
  const order = await prisma.bookOrder.findUnique({
    where: { id: orderId },
    include: bookOrderInclude,
  });

  if (!order) {
    throw new ApiError(404, "Book order not found");
  }

  if (TERMINAL_STATUSES.includes(order.status)) {
    throw new ApiError(
      400,
      `Cannot update an order that is already ${order.status.toLowerCase()}`
    );
  }

  const statusTimestamps = {};
  if (status === "PROCESSING" && !order.processedAt) statusTimestamps.processedAt = new Date();
  if (status === "SHIPPED" && !order.shippedAt) statusTimestamps.shippedAt = new Date();
  if (status === "DELIVERED" && !order.deliveredAt) statusTimestamps.deliveredAt = new Date();
  if (status === "CANCELLED" && !order.cancelledAt) statusTimestamps.cancelledAt = new Date();

  const data = { status, ...statusTimestamps };
  if (typeof adminNotes !== "undefined") data.adminNotes = adminNotes || null;

  const updatedOrder = await prisma.bookOrder.update({
    where: { id: orderId },
    data,
    include: bookOrderInclude,
  });

  // Send status update email to user — best-effort
  sendEmail({
    to: order.user.email,
    ...buildBookOrderStatusUpdateTemplate({
      order: updatedOrder,
      book: order.book,
      newStatus: status,
    }),
  }).catch((err) =>
    console.error("[BookOrder] Failed to send status update email:", err.message)
  );

  return updatedOrder;
};

// ─── Admin: list + detail ─────────────────────────────────────────────────────

export const listAdminBookOrders = async ({ page, limit, status, search, bookId }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    ...(status ? { status } : {}),
    ...(bookId ? { bookId } : {}),
    ...(search
      ? {
          OR: [
            { deliveryName: { contains: search, mode: "insensitive" } },
            { deliveryEmail: { contains: search, mode: "insensitive" } },
            { deliveryPhone: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { book: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.bookOrder.findMany({
      where,
      include: bookOrderInclude,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.bookOrder.count({ where }),
  ]);

  return {
    items,
    pagination: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
};

export const getAdminBookOrderById = async (orderId) => {
  const order = await prisma.bookOrder.findUnique({
    where: { id: orderId },
    include: bookOrderInclude,
  });

  if (!order) {
    throw new ApiError(404, "Book order not found");
  }

  return order;
};

// ─── User: my orders ──────────────────────────────────────────────────────────

export const listMyBookOrders = async ({ userId, page, limit, status }) => {
  const pagination = getPagination({ page, limit });

  const where = {
    userId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.bookOrder.findMany({
      where,
      include: bookOrderInclude,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.bookOrder.count({ where }),
  ]);

  return {
    items,
    pagination: buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total }),
  };
};

export const getMyBookOrderById = async ({ userId, orderId }) => {
  const order = await prisma.bookOrder.findUnique({
    where: { id: orderId },
    include: bookOrderInclude,
  });

  if (!order || order.userId !== userId) {
    throw new ApiError(404, "Order not found");
  }

  return order;
};
