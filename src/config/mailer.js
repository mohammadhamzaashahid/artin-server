import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "./env.js";

let resendClient = null;
let smtpTransporter = null;

export const getEmailFromAddress = () => {
  return `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_EMAIL}>`;
};

export const getResendClient = () => {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
};

export const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return smtpTransporter;
};