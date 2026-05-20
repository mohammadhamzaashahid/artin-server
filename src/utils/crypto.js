import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 12;

export const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

export const comparePassword = async (plainPassword, passwordHash) => {
  return bcrypt.compare(plainPassword, passwordHash);
};

export const generateNumericOtp = (length = 6) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;

  return String(crypto.randomInt(min, max + 1));
};

export const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
};

export const compareOtp = (plainOtp, otpHash) => {
  return hashOtp(plainOtp) === otpHash;
};

export const hashToken = (token) => {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
};