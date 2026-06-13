import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

export const getUploadsDir = () => env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR;

export const buildLocalPublicUrl = (objectKey) => {
  if (!objectKey) return null;
  const base = env.SERVER_BASE_URL.replace(/\/+$/, "");
  const encodedKey = objectKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/uploads/${encodedKey}`;
};

export const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};
