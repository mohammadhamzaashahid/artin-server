import { env } from "../../config/env.js";
import { getEmailFromAddress, getResendClient, getSmtpTransporter } from "../../config/mailer.js";

export const sendEmail = async ({ to, subject, html, text }) => {
  if (env.EMAIL_PROVIDER === "console") {
    console.log("EMAIL_PROVIDER=console");
    console.log({
      from: getEmailFromAddress(),
      to,
      subject,
      text,
      html,
    });

    return {
      provider: "console",
      id: `console_${Date.now()}`,
    };
  }

  if (env.EMAIL_PROVIDER === "resend") {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: getEmailFromAddress(),
      to,
      subject,
      html,
      text,
    });

    if (error) {
      throw new Error(error.message || "Failed to send email using Resend");
    }

    return {
      provider: "resend",
      id: data?.id,
    };
  }

  if (env.EMAIL_PROVIDER === "smtp") {
    const transporter = getSmtpTransporter();

    const info = await transporter.sendMail({
      from: getEmailFromAddress(),
      to,
      subject,
      html,
      text,
    });

    return {
      provider: "smtp",
      id: info.messageId,
    };
  }

  throw new Error(`Unsupported email provider: ${env.EMAIL_PROVIDER}`);
};