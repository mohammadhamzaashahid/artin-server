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