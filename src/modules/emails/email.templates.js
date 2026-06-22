import { env } from "../../config/env.js";

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const baseLayout = ({ title, previewText, body }) => {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${escapeHtml(previewText)}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:26px 28px;border-bottom:1px solid #eef0f4;">
                    <h1 style="margin:0;font-size:20px;line-height:28px;color:#111827;">
                      ${escapeHtml(env.EMAIL_FROM_NAME)}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px;">
                    ${body}
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #eef0f4;">
                    <p style="margin:0;font-size:12px;line-height:18px;color:#6b7280;">
                      Need help? Contact us at ${escapeHtml(env.SUPPORT_EMAIL)}.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export const buildEmailOtpTemplate = ({ firstName, otp }) => {
  const safeName = escapeHtml(firstName || "there");
  const safeOtp = escapeHtml(otp);

  return {
    subject: "Verify your email address",
    text: `Hello ${firstName || "there"}, your verification code is ${otp}. This code expires in 10 minutes.`,
    html: baseLayout({
      title: "Verify your email address",
      previewText: "Use this OTP to verify your email address.",
      body: `
        <h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">Verify your email</h2>
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
          Hello ${safeName}, use the code below to verify your email address.
        </p>

        <div style="margin:24px 0;padding:18px 20px;text-align:center;background:#111827;border-radius:14px;">
          <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#ffffff;">${safeOtp}</span>
        </div>

        <p style="margin:0;font-size:14px;line-height:22px;color:#6b7280;">
          This code expires in 10 minutes. If you did not request this, you can ignore this email.
        </p>
      `,
    }),
  };
};

export const buildPasswordResetTemplate = ({ firstName, otp }) => {
  const safeName = escapeHtml(firstName || "there");
  const safeOtp = escapeHtml(otp);

  return {
    subject: "Reset your password",
    text: `Hello ${firstName || "there"}, your password reset code is ${otp}. This code expires in 10 minutes.`,
    html: baseLayout({
      title: "Reset your password",
      previewText: "Use this OTP to reset your password.",
      body: `
        <h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">Reset your password</h2>
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
          Hello ${safeName}, use the code below to reset your password.
        </p>

        <div style="margin:24px 0;padding:18px 20px;text-align:center;background:#111827;border-radius:14px;">
          <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#ffffff;">${safeOtp}</span>
        </div>

        <p style="margin:0;font-size:14px;line-height:22px;color:#6b7280;">
          This code expires in 10 minutes. If you did not request this, please ignore this email.
        </p>
      `,
    }),
  };
};

export const buildBookOrderAdminNotificationTemplate = ({ order, book, user }) => {
  const safeName = escapeHtml(order.deliveryName);
  const safeEmail = escapeHtml(order.deliveryEmail);
  const safePhone = escapeHtml(order.deliveryPhone);
  const safeAddress = escapeHtml(order.deliveryAddress);
  const safeCity = escapeHtml(order.deliveryCity);
  const safeState = escapeHtml(order.deliveryState || "");
  const safePostal = escapeHtml(order.deliveryPostalCode || "");
  const safeCountry = escapeHtml(order.deliveryCountry);
  const safeNotes = escapeHtml(order.deliveryNotes || "None");
  const safeBookTitle = escapeHtml(book.title);
  const safeUserEmail = escapeHtml(user.email);
  const safeUserName = escapeHtml(`${user.firstName} ${user.lastName}`);

  const addressLine = [safeAddress, safeCity, safeState, safePostal, safeCountry]
    .filter(Boolean)
    .join(", ");

  return {
    subject: `New Book Order — ${book.title} (Order #${order.id.slice(-8).toUpperCase()})`,
    text: `New order placed for "${book.title}" by ${user.firstName} ${user.lastName} (${user.email}). Qty: ${order.quantity}, Total: ${order.totalAmount} ${order.currency}. Deliver to: ${order.deliveryName}, ${addressLine}. Notes: ${order.deliveryNotes || "None"}.`,
    html: baseLayout({
      title: "New Book Order",
      previewText: `New order for "${book.title}" from ${user.firstName} ${user.lastName}`,
      body: `
        <h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">New Book Order</h2>
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
          A new order has been placed. Please review and process it.
        </p>

        <div style="margin:0 0 16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Order Details</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Order ID:</strong> #${escapeHtml(order.id.slice(-8).toUpperCase())}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Book:</strong> ${safeBookTitle}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Quantity:</strong> ${order.quantity}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Total:</strong> ${order.totalAmount} ${escapeHtml(order.currency)}</p>
        </div>

        <div style="margin:0 0 16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Customer</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Name:</strong> ${safeUserName}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Email:</strong> ${safeUserEmail}</p>
        </div>

        <div style="margin:0 0 16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Delivery Details</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Name:</strong> ${safeName}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Phone:</strong> ${safePhone}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Address:</strong> ${addressLine}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Notes:</strong> ${safeNotes}</p>
        </div>
      `,
    }),
  };
};

export const buildBookOrderConfirmationTemplate = ({ order, book }) => {
  const safeName = escapeHtml(order.deliveryName);
  const safeBookTitle = escapeHtml(book.title);
  const addressLine = [
    order.deliveryAddress,
    order.deliveryCity,
    order.deliveryState,
    order.deliveryPostalCode,
    order.deliveryCountry,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  return {
    subject: `Order Confirmed — ${book.title}`,
    text: `Hello ${order.deliveryName}, your order for "${book.title}" has been received. Order ID: #${order.id.slice(-8).toUpperCase()}. Qty: ${order.quantity}, Total: ${order.totalAmount} ${order.currency}. We will process your order shortly.`,
    html: baseLayout({
      title: "Order Confirmed",
      previewText: `Your order for "${book.title}" has been received.`,
      body: `
        <h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">Order Received!</h2>
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
          Hello ${safeName}, thank you for your order. We have received it and will process it shortly.
        </p>

        <div style="margin:0 0 16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Order Summary</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Order ID:</strong> #${escapeHtml(order.id.slice(-8).toUpperCase())}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Book:</strong> ${safeBookTitle}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Quantity:</strong> ${order.quantity}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Total:</strong> ${order.totalAmount} ${escapeHtml(order.currency)}</p>
        </div>

        <div style="margin:0 0 16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Delivery Address</p>
          <p style="margin:0;font-size:14px;color:#374151;">${addressLine}</p>
        </div>

        <p style="margin:0;font-size:14px;line-height:22px;color:#6b7280;">
          You will receive another email when your order status is updated. If you have any questions, please contact us.
        </p>
      `,
    }),
  };
};

export const buildBookOrderStatusUpdateTemplate = ({ order, book, newStatus }) => {
  const safeName = escapeHtml(order.deliveryName);
  const safeBookTitle = escapeHtml(book.title);

  const statusMessages = {
    PROCESSING: {
      headline: "Your Order is Being Processed",
      body: "Great news! We have confirmed your order and are now preparing it for dispatch.",
      preview: "Your order is being prepared.",
    },
    SHIPPED: {
      headline: "Your Order Has Been Shipped",
      body: "Your order is on its way! You should receive it within the estimated delivery time.",
      preview: "Your order is on the way!",
    },
    DELIVERED: {
      headline: "Your Order Has Been Delivered",
      body: "Your order has been marked as delivered. We hope you enjoy it!",
      preview: "Your order has been delivered.",
    },
    CANCELLED: {
      headline: "Your Order Has Been Cancelled",
      body: "Unfortunately, your order has been cancelled. Please contact us if you have any questions.",
      preview: "Your order was cancelled.",
    },
  };

  const info = statusMessages[newStatus] || {
    headline: `Order Status Update: ${newStatus}`,
    body: `Your order status has been updated to ${newStatus}.`,
    preview: `Order status: ${newStatus}`,
  };

  return {
    subject: `${info.headline} — ${book.title}`,
    text: `Hello ${order.deliveryName}, ${info.body} Order ID: #${order.id.slice(-8).toUpperCase()}, Book: "${book.title}".`,
    html: baseLayout({
      title: info.headline,
      previewText: info.preview,
      body: `
        <h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">${escapeHtml(info.headline)}</h2>
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
          Hello ${safeName}, ${escapeHtml(info.body)}
        </p>

        <div style="margin:0 0 16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
          <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Order ID:</strong> #${escapeHtml(order.id.slice(-8).toUpperCase())}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Book:</strong> ${safeBookTitle}</p>
        </div>

        <p style="margin:0;font-size:14px;line-height:22px;color:#6b7280;">
          If you have any questions about your order, please contact us.
        </p>
      `,
    }),
  };
};

export const buildAdminCreatedTemplate = ({ firstName, email, temporaryPassword }) => {
  const safeName = escapeHtml(firstName || "there");
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);

  return {
    subject: "Your account has been created",
    text: `Hello ${firstName || "there"}, your account has been created. Email: ${email}. Temporary password: ${temporaryPassword}. Please login and change it immediately.`,
    html: baseLayout({
      title: "Account created",
      previewText: "Your account has been created.",
      body: `
        <h2 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#111827;">Account created</h2>
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#374151;">
          Hello ${safeName}, your account has been created.
        </p>

        <div style="margin:18px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;">
          <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin:0;font-size:14px;color:#374151;"><strong>Temporary password:</strong> ${safePassword}</p>
        </div>

        <p style="margin:0;font-size:14px;line-height:22px;color:#6b7280;">
          Please login and change this password immediately.
        </p>
      `,
    }),
  };
};