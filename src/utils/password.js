import crypto from "crypto";

export const generateTemporaryPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const all = upper + lower + numbers;

  const pick = (chars) => chars[crypto.randomInt(0, chars.length)];

  let password = `${pick(upper)}${pick(lower)}${pick(numbers)}`;

  while (password.length < 12) {
    password += pick(all);
  }

  return password
    .split("")
    .sort(() => crypto.randomInt(0, 3) - 1)
    .join("");
};